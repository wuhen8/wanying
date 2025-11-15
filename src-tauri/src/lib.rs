// src-tauri/src/lib.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 1. *** 添加所有需要的 `use` 语句 ***
use base64::{engine::general_purpose, Engine as _};
use futures_util::TryStreamExt;
use std::collections::HashMap;
use url::Url;
use warp::http::Response as HttpResponse;
use warp::hyper::Body;
use warp::{Filter, Rejection, Reply};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 启动本地代理服务器
async fn start_proxy_server() {
    let proxy_route = warp::path("proxy")
        .and(warp::query::<HashMap<String, String>>())
        .and(warp::header::optional::<String>("range"))
        .and_then(handle_proxy_request);

    // *** 新增：定义 CORS 规则 ***
    let cors = warp::cors()
        .allow_any_origin() // 允许来自任何源的请求
        .allow_methods(vec!["GET", "POST", "OPTIONS"]) // 允许的 HTTP 方法
        .allow_headers(vec!["Content-Type", "Range"]); // 允许的请求头

    // *** 修改：将 CORS 规则应用到路由上 ***
    let routes_with_cors = proxy_route.with(cors);

    println!("🚀 代理服务器启动在 http://127.0.0.1:7878");
    warp::serve(routes_with_cors)
        .run(([0, 0, 0, 0], 7878))
        .await;
}

// 代理请求的处理函数
async fn handle_proxy_request(
    params: HashMap<String, String>,
    range_header: Option<String>,
) -> Result<impl Reply, Rejection> {
    println!("📥 收到代理请求");

    let encoded_url_str = params.get("url").ok_or_else(warp::reject)?;
    let real_url = match general_purpose::URL_SAFE_NO_PAD.decode(encoded_url_str.as_bytes()) {
        Ok(bytes) => String::from_utf8(bytes).map_err(|_| warp::reject())?,
        Err(_) => {
            return Ok(warp::reply::with_status(
                "Invalid Base64 URL",
                warp::http::StatusCode::BAD_REQUEST,
            )
            .into_response())
        }
    };

    let encoded_cookie = params.get("cookie").cloned().unwrap_or_default();
    let cookies = match general_purpose::URL_SAFE_NO_PAD.decode(encoded_cookie.as_bytes()) {
        Ok(bytes) => String::from_utf8(bytes).unwrap_or_default(),
        Err(_) => String::new(),
    };

    let client = reqwest::Client::new();
    let mut req_builder = client
        .get(&real_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch")
        .header("Referer", "https://pan.quark.cn/")
        .header("Origin", "https://pan.quark.cn/");

    if !cookies.is_empty() {
        req_builder = req_builder.header("Cookie", &cookies);
    }
    if let Some(range) = range_header {
        req_builder = req_builder.header("Range", range);
    }

    println!("🚀 发送请求至: {}", real_url);

    // if let Some(request_to_print) = req_builder.try_clone() {
    //     if let Ok(built_request) = request_to_print.build() {
    //         println!("  -> 即将发送至夸克的 Headers:");
    //         for (key, value) in built_request.headers().iter() {
    //             println!("     {}: {:?}", key, value);
    //         }
    //     }
    // }

    match req_builder.send().await {
        Ok(response) => {
            let status = response.status();
            let headers = response.headers().clone();

            let is_m3u8 = headers
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|val| val.to_str().ok())
                .map_or(false, |s| s.contains("mpegurl"));

            let mut reply_builder = HttpResponse::builder().status(status);

            // *** ↓↓↓ 新增代码 ↓↓↓ ***
            // 强制声明我们支持范围请求，这对视频流至关重要
            reply_builder = reply_builder.header("Accept-Ranges", "bytes");

            // *** 关键修复：转发头时，跳过 Content-Length 和 Transfer-Encoding ***
            for (name, value) in headers.iter() {
                let lower_name = name.as_str().to_lowercase();
                if lower_name != "transfer-encoding" && lower_name != "content-length" {
                    reply_builder = reply_builder.header(name.as_str(), value.as_bytes());
                }
            }

            if is_m3u8 {
                println!("📝 检测到 M3U8 文件，正在重写 URL...");

                let base_url = Url::parse(&real_url).map_err(|_| warp::reject())?;
                let body_text = response.text().await.map_err(|_| warp::reject())?;

                let mut rewritten_body = String::new();

                for line in body_text.lines() {
                    if line.trim().is_empty() || line.starts_with('#') {
                        rewritten_body.push_str(line);
                    } else {
                        let absolute_ts_url =
                            base_url.join(line.trim()).map_err(|_| warp::reject())?;
                        let encoded_ts_url =
                            general_purpose::URL_SAFE_NO_PAD.encode(absolute_ts_url.as_str());
                        let proxy_ts_url = format!(
                            "http://127.0.0.1:7878/proxy?url={}&cookie={}",
                            encoded_ts_url, encoded_cookie
                        );
                        rewritten_body.push_str(&proxy_ts_url);
                        // 2. 直接将补全后的绝对 URL 添加到新的 body 中
                        // rewritten_body.push_str(absolute_ts_url.as_str());
                    }
                    rewritten_body.push('\n');
                }

                // 使用重写后的 body 构建响应，并设置正确的 Content-Length
                let final_response = reply_builder
                    .header("Content-Length", rewritten_body.len().to_string())
                    .body(rewritten_body)
                    .unwrap();
                println!(
                    "✅ M3U8 文件重写完成，返回 {} bytes",
                    final_response.body().len()
                );
                Ok(final_response.into_response())
            } else {
                // *** 改造：使用流式传输 ***
                println!("✅ 开始流式转发数据");

                let stream = response.bytes_stream().map_err(|e| {
                    eprintln!("流传输错误: {}", e);
                    std::io::Error::new(std::io::ErrorKind::Other, e)
                });

                Ok(reply_builder
                    .body(Body::wrap_stream(stream))
                    .unwrap()
                    .into_response())
            }
        }
        Err(e) => {
            eprintln!("❌ 请求失败: {}", e);
            Ok(warp::reply::with_status(
                e.to_string(),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            )
            .into_response())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(start_proxy_server());
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .plugin(tauri_plugin_videoplayer::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

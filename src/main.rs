mod analysis;
mod api;
mod claude_code;
mod codex;
mod domain;
mod opencode;
mod pi;
mod pricing;
mod server;
mod source;
mod vscode_copilot;

use clap::Parser;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    server::run(server::Args::parse()).await
}

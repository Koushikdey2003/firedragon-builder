FROM denoland/deno:bin-2.2.9 AS deno

FROM ubuntu:latest

# Update system
RUN apt-get update
RUN apt-get upgrade -y

# Install dependencies
RUN apt-get install -y curl file msitools nodejs p7zip-full patch python3-pip ripgrep rsync rustup zip zstd

# Setup rust with all required toolchains
RUN rustup default stable
RUN rustup target add x86_64-unknown-linux-gnu
RUN rustup target add aarch64-unknown-linux-gnu
RUN rustup target add x86_64-pc-windows-msvc
RUN rustup target add aarch64-pc-windows-msvc
RUN rustup target add x86_64-apple-darwin
RUN rustup target add aarch64-apple-darwin

# Install deno
COPY --from=deno /deno /usr/bin/deno

# Allow running appimage inside container
ENV APPIMAGE_EXTRACT_AND_RUN=1

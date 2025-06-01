FROM denoland/deno:ubuntu-2.2.9
RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y curl file msitools p7zip-full patch python3-pip ripgrep rsync zip zstd

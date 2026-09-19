#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${project_dir}/dist/gospel-share"

mkdir -p "${output_dir}/assets/images/gospel"
cp "${project_dir}/docs/gospel-recipient-prototype.html" "${output_dir}/index.html"
cp "${project_dir}/assets/images/gospel/1.png" "${output_dir}/assets/images/gospel/1.png"
cp "${project_dir}/assets/images/gospel/3.png" "${output_dir}/assets/images/gospel/3.png"
cp "${project_dir}/assets/images/gospel/5.png" "${output_dir}/assets/images/gospel/5.png"
cp "${project_dir}/assets/images/gospel/7.png" "${output_dir}/assets/images/gospel/7.png"
cp "${project_dir}/assets/images/gospel/8.png" "${output_dir}/assets/images/gospel/8.png"
cp "${project_dir}/assets/images/gospel/9.png" "${output_dir}/assets/images/gospel/9.png"
cp "${project_dir}/assets/images/gospel/10.png" "${output_dir}/assets/images/gospel/10.png"
cp "${project_dir}/assets/images/gospel/11.png" "${output_dir}/assets/images/gospel/11.png"
cp "${project_dir}/assets/images/gospel/12.png" "${output_dir}/assets/images/gospel/12.png"
printf '/gospel/* /index.html 200\n' > "${output_dir}/_redirects"
printf 'RewriteEngine On\n\nRewriteCond %%{REQUEST_FILENAME} !-f\nRewriteCond %%{REQUEST_FILENAME} !-d\nRewriteRule ^gospel/ index.html [L]\n' > "${output_dir}/.htaccess"

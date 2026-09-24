#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${project_dir}/dist/gospel"
gospel_images_dir="${output_dir}/assets/images/gospel"

if [[ "${gospel_images_dir}" != "${project_dir}/dist/gospel/assets/images/gospel" ]]; then
  printf 'Refusing to clean unexpected Gospel image directory: %s\n' "${gospel_images_dir}" >&2
  exit 1
fi
rm -rf "${gospel_images_dir}"
mkdir -p "${gospel_images_dir}"
cp "${project_dir}/docs/gospel-recipient-prototype.html" "${output_dir}/index.html"
cp "${project_dir}"/assets/images/gospel/*.png "${gospel_images_dir}/"
cp "${project_dir}/assets/images/journalbysifia-app-icon.png" "${output_dir}/assets/images/journalbysifia-app-icon.png"
printf '/gospel/* /index.html 200\n' > "${output_dir}/_redirects"
printf 'RewriteEngine On\n\nRewriteCond %%{REQUEST_FILENAME} !-f\nRewriteCond %%{REQUEST_FILENAME} !-d\nRewriteRule ^gospel/ index.html [L]\n' > "${output_dir}/.htaccess"

const child_process = require("child_process");
const output_filename = "gangnam.mp4";
const url = "https://www.youtube.com/watch?v=9bZkp7q19f0";
let process = child_process.exec(`python3 yt-dlp --downloader ffmpeg --downloader-args "ffmpeg:-c:v libx264 -crf 28 -preset medium" -o gangnam.mp4 ${url}`)
process.stderr.on('data', (d) => { console.log(d)})
process.stdout.on('data', (d) => { console.log(d)})
process.on('close', (data) => {
    let new_process = child_process.exec(`node --version`)
    new_process.stderr.on('data', (d) => { console.log(d)})
    new_process.stdout.on('data', (d) => { console.log(d)})
})



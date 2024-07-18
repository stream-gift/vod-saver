// Requires ffmpeg installed locally
// Requires GraphicsMagick installed locally
// Requires python3 installed locally
// Requires ytp-dlb binary in exec folder

const express = require('express')
const { z } = require("zod");

const ffmpeg = require('ffmpeg');
const gm = require("gm");

const crypto = require("crypto");
const child_process = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.json());

const dataPath = path.join(__dirname, "..", "data");

const videosPath = path.join(dataPath, "videos");
const thumbsPath = path.join(dataPath, "thumbs");
const gifsPath = path.join(dataPath, "gifs");

if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
if (!fs.existsSync(videosPath)) fs.mkdirSync(videosPath);
if (!fs.existsSync(thumbsPath)) fs.mkdirSync(thumbsPath);
if (!fs.existsSync(gifsPath)) fs.mkdirSync(gifsPath);

// For allowing theta to download video
app.use('/videos', express.static(videosPath));

// For user-access
app.use('/thumbs', express.static(thumbsPath));
app.use('/gifs', express.static(thumbsPath));


const VideoPostSchema = z.object({
    userId: z.string(),
    videoUrl: z.string().url(),
});

app.post("/api/video/start", (req, res) => {
    try {
        const data = VideoPostSchema.parse(req.body);
        const { userId, videoUrl } = data;

        const hash = createHash();

        console.info(`[${userId}:${hash}] Downloading video: ${videoUrl}`);
        downloadVideo(videoUrl, hash, userId);

        // Save to DB and return JSON
        res.json({ success: true, data, hash });
    } catch (error) {
        console.error(error);

        res.json({
            success: false,
            error: error.name === "ZodError" ? "Invalid Input" : error.message
        });
    }
});

const port = 5000;

app.listen(port, () => {
  console.log(`Listening on port :${port}`);
})

const processMapTimes = {};

/**
 * @description Downloads video from URL using ytp-dl and saves thumbnail from random frame. Also generates a gif from 5 sequential frames to display on thumbnail hover.
 * @param {string} videoUrl URL of the video to download
 * @param {string} hash hash of the video
 */
function downloadVideo(videoUrl, hash, userId) {
    const outPath = path.join(videosPath, `${hash}.mp4`);
    processMapTimes[hash] = new Date();
    const process = child_process.exec(`python3 yt-dlp --downloader ffmpeg --downloader-args "ffmpeg:-c:v libx264 -crf 28 -preset medium" -o ${outPath} ${videoUrl}`)

    // process.stderr.on('data', (d) => { console.log(d)})
    // process.stdout.on('data', (d) => { console.log(d)})

    process.on("exit", () => {
        const start = processMapTimes[hash];
        const end = new Date();
        const totalSeconds = (end.getTime() - start.getTime()) / 1000;

        console.info(`[${userId}:${hash}] Successfully downloaded video, took ${totalSeconds} seconds`);

        // Get first frame
        const thumbsOutPath = path.join(thumbsPath, hash);
        const vidProcess = new ffmpeg(outPath);
        
        vidProcess.then(function (video) {
            fs.writeFileSync(path.join(__dirname, "..", "out", `${hash}.json`), JSON.stringify(video, null, 4));

            const duration = video.metadata.duration.raw;
            const seconds = video.metadata.duration.seconds;
            const sizeInMb = fs.statSync(outPath).size / (1024 * 1024);

            console.info(`[${userId}:${hash}] Video size: ${sizeInMb.toFixed(2)}mb, duration: ${duration} (${seconds} seconds)`)

            video.fnExtractFrameToJPG(thumbsOutPath, {
                frame_rate: 1,
                number: 8,
                size: '1280x720',
                keep_pixel_aspect_ratio: true,
                file_name: `thumb.jpg`,
                every_n_seconds: Math.floor(seconds / 8),
            }, function (error, files) {
                if (error) {   
                    console.error(`[${userId}:${hash}] Failed to save thumbnail!`);
                    console.error(error);
                    return;
                }
                
                const total = files.length;
                const randomThumb = files[Math.floor(Math.random() * total)];
                const randomThumbOutPath = path.join(thumbsPath, `thumb_${hash}.jpg`);

                fs.copyFileSync(randomThumb, randomThumbOutPath);

                console.info(`[${userId}:${hash}] Successfully saved thumbnail`);

                const gifOutPath = path.join(gifsPath, `gif_${hash}.gif`);
                let graphics = gm();

                for (let i = 0; i < total; i++) {
                    graphics = graphics.in(files[i]);
                }

                graphics
                    .delay(100)
                    .resize(1280, 720)
                    .write(gifOutPath, function(err){
                        if (err) {
                            console.error(`[${userId}:${hash}] Failed to save GIF!`);
                            console.error(error);
                            return;
                        }

                        console.info(`[${userId}:${hash}] Successfully saved GIF`);
                        
                        // Delete folder
                        fs.rmdirSync(thumbsOutPath, { recursive: true, force: true });
                    });
                
            });
          }, function (err) {
            console.log('Error: ' + err);
          });
    });
};

function createHash() {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(timestamp + randomBytes).digest('hex');

    return hash;
}

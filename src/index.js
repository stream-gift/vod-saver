// Requires ffmpeg installed locally
// Requires GraphicsMagick installed locally
// Requires python3 installed locally
// Requires ytp-dlb binary in exec folder
require('dotenv/config');
require('log-timestamp');

const THETA_API_KEY = process.env.THETA_API_KEY
const THETA_API_SECRET = process.env.THETA_API_SECRET
const PUBLIC_URL = process.env.PUBLIC_URL

const express = require('express')
const axios = require('axios');
const { z } = require("zod");

const ffmpeg = require('ffmpeg');
const gm = require("gm");

const crypto = require("crypto");
const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const { createVideo, getUserVideos, updateVideo, getVideoByHash, getUploadingVideos } = require('./db');

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
app.use('/gifs', express.static(gifsPath));

app.get("/api/videos", async (req, res) => {
    const userid = req.query.userid;
    
    const { rows, count } = await getUserVideos(userid);
    
    res.json({ success: true, data: { rows, count } });
});

app.get("/api/videos/status", async (req, res) => {
    const hash = req.query.hash;
    let video = await getVideoByHash(hash);
    
    if (!video) {
        res.json({ success: false, error: "Invalid Input!" });
        return;
    }
    
    const status = await getThetaVideoStatus(video.thetaid);

    if (status.progress == 100 && video.status === "uploading") {
        updateVideo(hash, {
            progress: status.progress.toString(),
            player: status.player_uri,
            status: !!status.player_uri ? "completed" : "uploading"
        });
        
        video = await getVideoByHash(hash);
    }
        
    const data = {
        progress: status.progress.toString(),
        video,
    };

    res.json({ success: true, data });
});

const VideoPostSchema = z.object({
    userid: z.string(),
    name: z.string().min(1),
    url: z.string().url(),
});

app.post("/api/videos/new", (req, res) => {
    try {
        const data = VideoPostSchema.parse(req.body);
        const { userid, name, url } = data;

        const hash = createHash();

        console.info(`[${userid}:${hash}] Downloading video: ${url}`);
        downloadVideo(url, hash, userid, name);

        // Save to DB and return JSON
        res.json({ success: true, data: { hash } });
    } catch (error) {
        console.info(error);

        res.json({
            success: false,
            error: error.name === "ZodError" ? "Invalid Input" : error.message
        });
    }
});

const processMapTimes = {};

/**
 * @description Downloads video from URL using ytp-dl and saves thumbnail from random frame. Also generates a gif from 5 sequential frames to display on thumbnail hover.
 * @param {string} videoUrl URL of the video to download
 * @param {string} hash hash of the video
 * @param {string} userid id of the user who requested video download
 */
function downloadVideo(videoUrl, hash, userid, name) {
    const outPath = path.join(videosPath, `${hash}.mp4`);
    
    createVideo({
        userid,
        name,
        hash,
        src: videoUrl,
        status: 'downloading'
    });
    
    processMapTimes[hash] = new Date();
    const process = child_process.exec(`python3 yt-dlp --downloader ffmpeg --downloader-args "ffmpeg:-c:v libx264 -crf 28 -preset medium" -o ${outPath} ${videoUrl}`)

    process.on("error", () => {
        console.info(`[${userid}:${hash}] Error downloading video`);
        console.info(error);
        updateVideo(hash, { status: "failed" });
    });

    process.on("exit", () => {
        const start = processMapTimes[hash];
        const end = new Date();
        const totalSeconds = (end.getTime() - start.getTime()) / 1000;

        console.info(`[${userid}:${hash}] Successfully downloaded video, took ${totalSeconds} seconds`);

        updateVideo(hash, { status: 'downloaded' });

        // Get first frame
        const thumbsOutPath = path.join(thumbsPath, hash);
        const vidProcess = new ffmpeg(outPath);
        
        vidProcess.then(function (video) {
            // Requires `out` folder in exec folder
            // fs.writeFileSync(path.join(__dirname, "..", "out", `${hash}.json`), JSON.stringify(video, null, 4));

            const duration = video.metadata.duration.raw;
            const seconds = video.metadata.duration.seconds;
            const sizeInMb = fs.statSync(outPath).size / (1024 * 1024);

            console.info(`[${userid}:${hash}] Video size: ${sizeInMb.toFixed(2)}mb, duration: ${duration} (${seconds} seconds)`)

            video.fnExtractFrameToJPG(thumbsOutPath, {
                frame_rate: 1,
                number: 8,
                size: '1280x720',
                keep_pixel_aspect_ratio: true,
                file_name: `thumb.jpg`,
                every_n_seconds: Math.floor(seconds / 8),
            }, function (error, files) {
                if (error) {   
                    console.info(`[${userid}:${hash}] Failed to save thumbnail!`);
                    console.info(error);
                    updateVideo(hash, { status: "failed" });
                    return;
                }
                
                const total = files.length;
                const randomThumb = files[Math.floor(Math.random() * total)];
                const randomThumbOutPath = path.join(thumbsPath, `thumb_${hash}.jpg`);

                fs.copyFileSync(randomThumb, randomThumbOutPath);

                console.info(`[${userid}:${hash}] Successfully saved thumbnail`);

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
                            console.info(`[${userid}:${hash}] Failed to save GIF!`);
                            console.info(error);
                            updateVideo(hash, { status: "failed" });
                            return;
                        }

                        console.info(`[${userid}:${hash}] Successfully saved GIF`);
                        
                        // Delete folder
                        fs.rmdirSync(thumbsOutPath, { recursive: true, force: true });
                        
                        updateVideo(hash, {
                            thumb: `/thumbs/thumb_${hash}.jpg`,
                            gif: `/gifs/gif_${hash}.gif`,
                            duration: duration.split(".")[0],
                            status: 'processed'
                        });

                        uploadVideo(hash, userid, name);
                    });

                
            });
          }, function (err) {
            console.log('Error: ' + err);
          });
    });
};

async function uploadVideo(hash, userid, name) {
    try {   
        updateVideo(hash, { status: 'uploading' });
        console.info(`[${userid}:${hash}] Starting video upload to Theta`);

        const request = await axios.post("https://api.thetavideoapi.com/video", {
            source_uri: PUBLIC_URL + `/videos/${hash}.mp4`,
            playback_policy: "public",
            metadata: {
                hash,
                userid,
                name,
            }
        }, {
            headers: {
                'x-tva-sa-id': THETA_API_KEY,
                'x-tva-sa-secret': THETA_API_SECRET
            }
        });

        const data = request.data;

        if (data.status !== "success") {
            throw new Error("Request Failed!");
        }

        const thetaid = data.body.videos[0].id;

        console.info(`[${userid}:${hash}] Successfully started video upload to Theta`);

        updateVideo(hash, { thetaid });
    } catch (error) {
        console.info(`[${userid}:${hash}] Error uploading video to Theta`);
        console.info(error);
        updateVideo(hash, { status: "failed" });
    }
};

function createHash() {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(timestamp + randomBytes).digest('hex');

    return hash;
}

async function getThetaVideoStatus(thetaid) {
    try {
        const request = await axios.get(`https://api.thetavideoapi.com/video/${thetaid}`, {
            headers: {
                'x-tva-sa-id': THETA_API_KEY,
                'x-tva-sa-secret': THETA_API_SECRET
            }
        });
        
        const data = request.data;
        const video = data.body.videos[0];
        
        return video;
    } catch (error) {
        console.info(error.message);
        return null;
    }
}

async function checkUploadingVideos() {
    console.info(`[UploadingVideoCheck] Running Check`);
    
    const videos = await getUploadingVideos();
    console.info(`[UploadingVideoCheck] Found ${videos.length} videos that are currently uploading`);
    
    for (const video of videos) {
        const status = await getThetaVideoStatus(video.thetaid);

        if (!status) {
            continue;
        }

        updateVideo(video.hash, {
            progress: status.progress.toString(),
            player: status.player_uri,
            status: !!status.player_uri ? "completed" : "uploading"
        });
        
        console.info(`[UploadingVideoCheck] [${video.userid}:${video.hash}] ThetaID: ${video.thetaid} Progress: ${status.progress}%`);
    }
}

// function cleanFailedVideo() {
//     // Delete Video
//     // Delete Thumbnail Folder
//     // Delete Thumbnail
//     // Delete GIF
// }

function main() {
    const port = process.env.PORT || 5000;

    app.listen(port, () => {
        console.log(`[Server] Listening on Port ${port} | Access: ${PUBLIC_URL}/`);

        app._router.stack.forEach(function(r){
            if (r.route && r.route.path){
                console.log(`[Server] ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`)
            }
        })
        
        checkUploadingVideos();
    });

    // Check every 3 mins
    setInterval(() => {
        checkUploadingVideos();
    }, 3 * 60 * 1000);
}

main();

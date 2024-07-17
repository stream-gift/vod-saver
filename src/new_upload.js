const child_process = require("child_process");
const dotenv = require('dotenv')
dotenv.config()
const output_filename = "gangnam.mp4";
const url = "https://www.youtube.com/watch?v=9bZkp7q19f0";
const axios = require('axios')

let apiKey = process.env.THETA_API_KEY
let apiSecret = process.env.THETA_API_SECRET




async function uploadVideo(file_name) {
    const resSignURL = await axios.post('https://api.thetavideoapi.com/upload', {}, {
        headers: {
            'x-tva-sa-id': apiKey,
            'x-tva-sa-secret': apiSecret
        }
    });
    console.log(resSignURL.data);
    let signedURL = resSignURL.data.body.uploads[0]?.presigned_url;
    let signedID = resSignURL.data.body.uploads[0]?.id;

    await axios.put(signedURL, videoFile, {
        headers: {
            'Content-Type': 'application/octet-stream',
        }
    });
    await transcodeVideo(signedID, 'gangnam', 'op op oppa gangnam style')


} uploadVideo('gangnam.mp4')

async function transcodeVideo(signedID, title, description) {
    let data = {
        source_upload_id:signedID, // or source_uri:"link to video"
        playback_policy:"public",
        resolutions: [720, 1080],
        use_drm: false,
        // drm_rules: [{
        //     chain_id: 361,
        //     nft_collection: "0x7fe9b08c759ed2591d19c0adfe2c913a17c54f0c"
        // }],
        metadata:{
            name:title,
            description:description
        }
    }
    const resTranscode = await axios.post('https://api.thetavideoapi.com/video', JSON.stringify(data), {
        headers: {
            'x-tva-sa-id': apiKeys.key,
            'x-tva-sa-secret': apiKeys.secret,
            'Content-Type': 'application/json'
        }
    });
    let id = String(resTranscode.data.body.videos[0].id);
    const response = await axios.get('https://api.thetavideoapi.com/video/' + id, {
        headers: {
            'x-tva-sa-id': apiKey,
            'x-tva-sa-secret': apiSecret,
        }
    });

}


// let upload_link = child_process.exec(`curl --location --request POST 'https://api.thetavideoapi.com/upload' \
// --header 'x-tva-sa-id: ${process.env.THETA_API_KEY}' \
// --header 'x-tva-sa-secret: ${process.env.THETA_API_SECRET}'`)

// bash.stderr.on('data', (d) => { console.log(d)})
// bash.stdout.on('data', (d) => { console.log(d)})
// bash.on('close', (data) => {
//     let new_process = child_process.exec(`node --version`)
//     new_process.stderr.on('data', (d) => { console.log(d)})
//     new_process.stdout.on('data', (d) => { console.log(d)})
// })

async function getVideoList() {
    axios.get(`https://api.thetavideoapi.com/video/${apiKey}/list`, {
        headers: {
            'x-tva-sa-id': apiKey,
            'x-tva-sa-secret': apiSecret,
        }
    }).then((res) => {
        console.log(res.data);
    }).catch((err) => {
        console.error("Error:", err);
    });
} 



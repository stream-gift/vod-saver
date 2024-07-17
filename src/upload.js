const child_process = require("child_process");
const dotenv = require('dotenv')
dotenv.config()
const output_filename = "gangnam.mp4";
const url = "https://www.youtube.com/watch?v=9bZkp7q19f0";


var request = require('request');
var options = {
  'method': 'POST',
  'headers': {
    'x-tva-sa-id': process.env.THETA_API_KEY,
    'x-tva-sa-secret': process.env.THETA_API_SECRET
  }
};

const getUploadURL = async () => {
    let res = await fetch('https://api.thetavideoapi.com/upload', options)
    if (!res.ok) throw new Error(res.error)
    res = await res.json();
    console.log(res)
    if (res.status == 'success') {
        console.log('presigned upload url, success, returning URL...')
        let url_values= {id: res.body['uploads'][0]?.id, presigned_url: res.body['uploads'][0]?.presigned_url }
        return url_values
      }
    }   


async function uploadVideo(file_name) {
    let url = await getUploadURL()
    let upload = child_process.exec(`curl --location --request PUT '${url.presigned_url}' \
--header 'Content-Type: application/octet-stream' \
--data-binary '/root/vod/${file_name}'`)
    upload.stderr.on('data', (d) => { console.log(d)})
    upload.stdout.on('data', (d) => { 
        console.log(d)

    })
    upload.on('close', (d) => {
        console.log('now transcoding...')
        let transcode = child_process.exec(`curl --location --request POST 'https://api.thetavideoapi.com/video' \
--header 'x-tva-sa-id: ${process.env.THETA_API_KEY}' \
--header 'x-tva-sa-secret: ${process.env.THETA_API_SECRET}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "source_upload_id": "${url.id}",
    "playback_policy": "public",
    "metadata": {
    		"key": "value"
    }
}'`)
transcode.stderr.on('data', (d) => { console.log(d)})
transcode.stdout.on('data', (d) => { 
    console.log(d)

})
    
    })


} uploadVideo('gangnam.mp4')


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

async function getVideoStatuses() {
    let status = child_process.exec(`curl --location --request GET 'https://api.thetavideoapi.com/video/${process.env.THETA_API_KEY}/list?page=1&number=100' \
--header 'x-tva-sa-id: ${process.env.THETA_API_KEY}' \
--header 'x-tva-sa-secret: ${process.env.THETA_API_SECRET}' `)
    status.stderr.on('data', (d) => { console.log(d)});
    status.stdout.on('data', (d) => { console.log(d)});
} 



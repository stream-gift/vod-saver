![stream.gift](public/banner.png)

## This repo is the backend functionality that allows you to host your VODs on-chain via Theta Edge Cloud.

The steps are as follows:

- Video gets downloaded to our dedicated server node

- Video then gets compressed with zero loss to improve upload speeds

- Video then gets uploaded to Theta Edge Cloud in a bash process.

- Upon uploading, the video upload status & VOD link should be added to the users' account.

Furthermore, we are looking to integrate further with Theta Edge Cloud's services, as we have been experimenting with
NVENC encoding which can be used to process our videos. 

We also utilize the open source tool  [yt-dlp](https://github.com/yt-dlp/yt-dlp) for downloading VODs 
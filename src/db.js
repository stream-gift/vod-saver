const path = require("path");
const fs = require("fs");

const { Sequelize, DataTypes } = require('sequelize');

const dbsPath = path.join(__dirname, "..", "dbs");
if (!fs.existsSync(dbsPath)) fs.mkdirSync(dbsPath);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(dbsPath, "videos.sqlite"),
    logging: false,
});

const Video = sequelize.define('Video', {
    userid: DataTypes.STRING,

    src: DataTypes.STRING,

    name: DataTypes.STRING,
    hash: DataTypes.STRING,
    
    thumb: DataTypes.STRING,
    gif: DataTypes.STRING,
    
    duration: DataTypes.STRING,
    
    thetaid: DataTypes.STRING,
    player: DataTypes.STRING,

    progress: DataTypes.STRING,
    
    // "downloading" | "downloaded" | "processed" | "uploading" | "completed" | "fail"
    status: DataTypes.STRING
});

sequelize.sync();

function createVideo(data = {}) {
    return Video.create({
        ...data,
    });
};

function updateVideo(hash, data) {
    return Video.update(
        { ...data },
        {
            where: {
                hash,
            },
        },
    );
};

function getUserVideos(userid) {
    return Video.findAndCountAll({
        where: {
            userid,
        }
    });
};

function getVideoByHash(hash) {
    return Video.findOne({
        where: {
            hash,
        }
    });
};

function getUploadingVideos() {
    return Video.findAll({
        where: {
            status: 'uploading',
        }
    });
}

module.exports = {
    createVideo,
    updateVideo,
    getUserVideos,
    getVideoByHash,
    getUploadingVideos,
}

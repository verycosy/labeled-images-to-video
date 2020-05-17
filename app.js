const cluster = require("cluster");
const fs = require("fs");

if (cluster.isMaster) {
  fs.readdir("./images", async (err, files) => {
    if (err) throw new Error(err);

    let cnt = 0;
    const total = 100;
    const dir = "./videos";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const directories = files.filter((file) => file !== ".DS_Store");
    const cpus = require("os").cpus().length;
    const divide = Number.parseInt(total / cpus);

    for (let i = 0; i < cpus; i++) {
      const worker = cluster.fork();
      worker.on("message", () => {
        console.log(`[${++cnt}/${total}]`);
      });
      worker.send({ directories, i: i * divide });
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log("worker " + worker.process.pid + " died");
    });
  });
} else {
  let cnt = 0;
  const ffmpeg = require("fluent-ffmpeg");
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  const ffprobePath = require("@ffprobe-installer/ffprobe").path;
  const videoshow = require("videoshow");
  const { v4: uuid } = require("uuid");

  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);

  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const getRandomClass = (count, directories) => {
    const result = [];
    const length = directories.length - 1;

    for (let i = 0; i < count; i++) {
      const rand = getRandomInt(0, length);
      result.push(directories[rand]);
    }

    return result;
  };

  const videoOptions = {
    fps: 30,
    loop: 0.1,
    format: "mp4",
    transition: false,
    videoCodec: "libx264",
    videoBitrate: 1024,
    pixelFormat: "yuv420p",
    size: "200x200",
  };

  const makeVideo = (filename, imageset) => {
    const tempFilename = `${uuid()}.mp4`;

    videoshow(imageset, videoOptions)
      .save(tempFilename)
      .on("start", (command) => console.log(`>> ${filename} start`))
      // .on("progress", (data) => console.log(`>> ${filename} processing ... `))
      .on("error", (err, stdout, stderr) => console.error(err))
      .on("end", (output) => {
        ffmpeg(output)
          .videoFilters(`setpts=${1 / 3}*PTS`)
          .save(`./videos/${filename}.mp4`)
          .on("end", () => {
            fs.unlink(tempFilename, (err) => {
              if (err) {
                console.error(err);
                return;
              }

              console.log(`[${process.pid}] ${filename} done`);

              if (cnt === 10) process.exit(0);

              cnt++;
              process.send("");
            });
          });
      });
  };

  const workInit = (directories, progressCount) => {
    for (let i = progressCount; i < progressCount + 10; i++) {
      const randomClass = getRandomClass(4, directories);

      const randomImages = [];
      randomClass.map((selectedClass) => {
        for (let i = 0; i < 30; i++) {
          const randomIndex = getRandomInt(1, 3000);
          randomImages.push(
            `./images/${selectedClass}/${selectedClass}${randomIndex}.jpg`
          );
        }
      });

      const filename = `${i}_${randomClass.join("_")}`;
      makeVideo(filename, randomImages);
    }
  };

  process.on("message", ({ directories, i }) => {
    console.log(`${process.pid} awake !!`);
    workInit(directories, i);
  });
}

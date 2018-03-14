const Jimp = require('jimp')
const glob = require('glob')
const crypto = require('crypto')
const fs = require('fs')
const async = require('async')
const R = require('ramda')
const im = require('imagemagick')

const hash = (s) => crypto.createHash('md5').update(s).digest('hex')

if (!fs.existsSync('./cache')) {
  fs.mkdirSync('./cache')
}

if (process.argv.length !== 3) {
  console.log('node index.js PATH/**/*.png')
  process.exit()
}

const dir = process.argv.pop()
console.log('Scanning', dir)

const findFiles = () => new Promise((resolve, reject) => {
  console.log('findFiles')
  glob(dir, {}, function (err, files) {
    if (err) return reject(err)
    else resolve(files)
  })
  
})

const updateCache = (files) => new Promise((resolve, reject) => {
  console.log('updateCache for', files.length)
  let index = 0
  async.mapSeries(files, (file, cb) => {
    const cachedFile = `./cache/${hash(file)}`
    console.log(`Updating cache ${index++} / ${files.length}`)
    if (fs.existsSync(cachedFile)) {
      setTimeout(() => cb(null, cachedFile), 1)
    } else {
      im.resize({ srcPath: file, width: 256, height: 256, dstPath: cachedFile }, (err) => cb(err, cachedFile))
    }
  }, (err, files) => {
    if (err) reject(err)
    else resolve(files)
  })
})

const mosaic = (cachedFiles) => new Promise((resolve, reject) => {
  const w = 2048 * 2
  const h = 2048 * 2
  const tw = 32
  const th = 32
  const nx = w / tw
    const canvas = new Jimp(w, h)
    const list = cachedFiles
    let index = 0
    const next = () => {
      const file = list.shift()
      if (!file) {
        canvas.write('./screenshots.png')
        return resolve(cachedFiles)
      }
      Jimp.read(file, (err, image) => {
        if (err) {
          console.log(err)
          return setTimeout(next, 1)
        }
        console.log(`Mosaic... ${list.length} left`, file)
        const x = tw * (index % nx)
        const y = th * Math.floor(index / nx)
        try {
          const thumb = image.cover(tw, th)
          canvas.blit(thumb, x, y)
          index++
          if (index % 10 === 0) {
            canvas.write('./screenshots.png')
          }
        } catch (e) {
          console.log(e)
        }
        setTimeout(next, 1)
      })
    }
    next()
})

const done = (files) => new Promise((resolve) => {
  console.log('done')
  console.log('e.g', files[0])
  resolve()
})

R.pipeP(findFiles, updateCache, mosaic, done)()

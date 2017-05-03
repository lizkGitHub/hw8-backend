const uploadImage = require('./uploadCloudinary').uploadImage
const multer = require('multer')
const stream = require('stream')
const User = require('./model.js').User
const Profile = require('./model.js').Profile

const getEntry = (entryName) => {
    return (req, res) => {
        const user = req.params.user ? req.params.user : req.username
        Profile.find({ username : user}).exec(function(err, profile) {
            if(err) {
                res.send(404, err)
            } else {
                if (profile.length === 0) {
                        res.send(404, `can't find ${user}`)
                    } else {
                        const result = {}
                        result["username"] = user
                        result[entryName] = profile[0][entryName]
                        console.log(entryName)
                        console.log(result)
                        res.send(result)
                    }
            }
        })
    }
}

const putEntry = (entryName, dataName) => {
    return (req, res) => {
        const query = {username: req.username}
        const update = {}
        update.username = req.username
        if(entryName === 'avatar') {
            const image =  req.fileurl ?  req.fileurl : "https://cdn1.iconfinder.com/data/icons/unique-round-blue/93/user-512.png"
        //     res.send({
        //     username : req.username,
        //     avatar : image
        // })
        }
        update[entryName] = (entryName === 'avatar') ? req[dataName] : req.body[dataName]
        console.log(update)
        Profile.findOneAndUpdate(query, update).exec(function(err, profile) {
            if (err) {
                res.send(404, err)
            } else {
                res.send(update)
            }
        })

    }
}

const getEntryWithId = (entryName, rstEntryName) => {
    return (req, res) => {
        const users = req.params.user ? req.params.user.split(',') : [req.username]
        Profile.find({ "username" : { "$in" : users}}).exec(function(err, profiles) {
            const rst = profiles.map(profile => {
                const subResult = {}
                subResult["username"] = profile.username
                subResult[entryName] = profile[entryName]
                return subResult
            })
            const result = {}
            result[rstEntryName] = rst
            res.send(result)
        })

    }
}



module.exports = {
     getEntry,
     profile : app => {
        app.get('/headlines/:users*?', getEntryWithId('headline', 'headlines'))
        app.put('/headline', putEntry('headline', 'headline'))
        app.get('/email/:user?', getEntry('email'))
        app.put('/email', putEntry('email', 'email'))
        app.get('/zipcode/:user?', getEntry('zipcode'))
        app.put('/zipcode', putEntry('zipcode', 'zipcode'))
        app.get('/avatars/:user?', getEntryWithId('avatar', 'avatars'))
        app.put('/avatar', uploadImage('avatar'), putEntry('avatar', 'fileurl'))
        //  app.put('/avatar', putAvatar)
        app.get('/dob', getEntry('dob'))

     }
}

const md5 = require('md5')
const cookieParser = require('cookie-parser') 
const passport = require('passport')
const session = require('express-session')
const FacebookStrategy = require('passport-facebook').Strategy;
const redis = require('redis').createClient("redis://h:p9da2b791b04168054e438d6fcf52c844010b304e4c097b3141529a2d7bd88934@ec2-34-206-56-13.compute-1.amazonaws.com:45849")

const User = require('./model.js').User
const Article = require('./model.js').Article
const Comment = require('./model.js').Comment
const Profile = require('./model.js').Profile

module.exports = {
	app:(app) => {
		app.use(cookieParser())
        app.use(findFrontend)
		app.use(session({ secret : 'thisIsSecrectMessage'}))
		app.use(passport.initialize())
		app.use(passport.session())
		app.post('/login', login)
		app.put('/logout', isLoggedIn, logout)
		app.post('/register', register)
		app.use('/auth/facebook', passport.authenticate('facebook', {scope : 'email'}))
		app.use('/auth/callback', passport.authenticate('facebook', {
			successRedirect : '/fbLogIn', failureRedirect : '/fail'
		}))
        app.use('/fbLogIn', fbLogIn)
		app.use('/fail', fail)
        app.use('/password', updatePassword)
        app.get('/authType', isLoggedIn,getAuthType)
        app.use('/link2Normal', isLoggedIn, link2Normal)
        app.use('/unlinkAccount', isLoggedIn, unlinkAccount)

	},
	isLoggedIn
	
}

const isLocal = false
const callbackURL = isLocal ? 'http://localhost:3000/auth/callback' : 'https://hw8backend-rice.herokuapp.com/auth/callback'
const configAuth = {
	clientSecret: 'eb646416e625a53b92990e75dfcaf68a', 
	clientID: '1894933807412672', 
	callbackURL: callbackURL,
    profileFields: ['emails', 'name', 'displayName', 'photos']
}
    // enableProof: true


let frontendUrl = ''

const cookieKey = 'sid'
// sid -> username
const sessionUser = {}

let defaultUser = 'zl51'

let defaultUserObj = {
    username: 'default user',
    salt: 'salt',
    hash: 'hash',
    email:'a@a.com',
    dob: '03/02/1994'
}
const register = (req, res) => {
	let username = req.body.username;
	let password = req.body.password;
    let email = req.body.email
    let dob = req.body.dob
    let zipcode = req.body.zipcode



    // in case the user already exist
	getUser(username, function (err, users) {
        if (!err) {
            if (users.length > 0) {
                console.log(`${username} has already been registered.`)
                res.send(409, {error : `${username} has already been registered.`})
                return
            } else {
                const userObj = { username }
                userObj.salt = 'add some salt' + username +
                    new Date().getTime().toString()
                userObj.hash = md5(userObj.salt + password)
                userObj.auth = {"normal" : username}
                // users.users.push(userObj)
                const profileObj = { username, email, dob, zipcode }
                profileObj.headline = ""
                profileObj.following = []
                profileObj.avatar = "https://cdn1.iconfinder.com/data/icons/unique-round-blue/93/user-512.png"
				// save profileObj only when userObj is saved
                new User(userObj).save(function(err, doc) {
                    if (err) {
                        res.send(err)
                    } else {
                        console.log('save user successfully! ', doc)
                        new Profile(profileObj).save(function (err, doc) {
                            if (err) {
                                res.send(err)
                            } else {
                                console.log('save profile successfully! ', doc)
                                const msg = {username : username, result : "success"}
                                res.send(msg)
                            }
                        })
                    }
                })
            }
        } else {
            throw err
            res.send(err)
        }
    })
}

function login(req, res) {
	// console.log(req.body)
	var username = req.body.username
	var password = req.body.password
	if (!username || !password) {
		res.sendStatus(400)
		return
	}

	getUser(username, function (err, users) {
        if (!err) {
            if (users.length === 0) {
                console.log(`can\'t find user ${username}`)
                return
            } else {
                console.log('find the user : ', users[0])
                const userObj =  users[0]
                if (!userObj) {
                    // unauthorized
                    res.status(401).send('this username does not exist')
                    return
                }
                const hash = md5(userObj.salt + password)
                if (hash !== userObj.hash) {
                    // unauthorized
                    res.status(401).send('password is wrong')
                    return
                }
                req.user = username

                // autherized, set cookie and send back message
                const sessionKey = generateCode(userObj)
                // sessionUser[cookieValue] = username
                redis.hmset(sessionKey, userObj)
                res.cookie(cookieKey, sessionKey, { maxAge : 3600*1000, httpOnly : true})
                const msg = {username : username, result : "success"}
                res.send(msg)
            }
        } else {
            throw err
        }
    })
}

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        console.log("isloggedin req.isAuthenticated()")
        // console.log(req)
        let username = req.user['_json']['first_name']+ req.user['_json']['last_name'] + "@facebook";
        const query = { 'auth.facebook' : username}
        User.findOne(query).exec()
        .then(doc => {
            
            if(doc != null) {
                username = doc.auth.normal ? doc.auth.normal : username
            }
            
            req.username = username
            return next()
        })
        
	}else {
        const sid = req.cookies[cookieKey]
        if(!sid) {
            return res.status(401).send('sid undefined - user session does not exist')
        }
        redis.hgetall(sid, function(err, userObj){
            if(userObj && userObj.username){
                console.log("userObj.username")
                console.log(userObj.username)
                req.username=userObj.username
                next()
            }else{
                return res.status(401).send('this user session does not exist')
            }
        })
    }
}

const updatePassword = (req, res) => {
    const newSalt = 'add some salt' + req.username + new Date().getTime().toString()
    const newHash = md5(newSalt + req.body.password)
    const query = {username: req.username}
    const update = {salt: newSalt, hash: newHash}

    User.findOneAndUpdate(query, update, {new: true}).exec((err, result) => {
        if(err) {
            res.send(404, err)
        } else {
            res.send({username: req.username, status: 'password has been changed, please relogin'})
        }
    })
}

const logout = (req, res) => {
    const username = req.username
	console.log('log out as ', username)
    if(req.isAuthenticated()) {
        req.session.destroy()
        req.logout()
        console.log('third party log out as ', username)
        res.status(200).send("OK")
    } else {
        const sid = req.cookies[cookieKey]
        redis.del(sid)
        res.clearCookie(cookieKey)
        console.log('normal log out as ', username)
        res.status(200).send("OK")
    }
}

const getUser = (username, callback) => {
	User.find({ username : username}).exec(callback)
}


const users = []
// used to serialize the user for the session
passport.serializeUser(function(user, done) {
    users[user.id] = user
    console.log("serializeUser", user)
    done(null, user.id)
})

// used to deserialize the user
passport.deserializeUser(function(id, done) {
    const user = users[id]
    console.log("deserializeUser", user)
    done(null, user)
})

const mergeUser = (fbUser, normalUser, res) => {
    console.log(`mergeUserRecord : ${fbUser} with ${normalUser}`)
    let query = { username : normalUser}
    let update = { auth : {'facebook' : fbUser, 'normal' : normalUser}}
    User.findOneAndUpdate(query, update, {new : true}).exec()
        .then(user => {
            if (user) {
                console.log(user)
            }

            Article.update({author: fbUser}, {author: normalUser}).exec()
            // update all the comments
            query = {"comments.author": fbUser}
            update = {"$set": {"comments.$.author": normalUser}}
            Article.update(query, update).exec()
        })
        // merge all the followings
        .then(Profile.findOne({ username : fbUser}).exec()
            .then(profile => {
                if (profile) {
                    return profile.following
                }
            })
            .then(following => {
                update = {"$addToSet" : { "$each" : {following : following}}}
                console.log(update)
                Profile.findOneAndUpdate({username : normalUser},
                    update, {new : true}).exec()
                    .then(newProfile => {
                        console.log(newProfile)
                    })
            })

        )
        .then(() => {
            // remove linking user record
            User.findOneAndRemove({username: fbUser}).exec()
                .then(doc => {
                    console.log(`findOneAndRemove ${doc}`)
                })
            console.log("mergeok")
            // res.redirect(frontendUrl)
            res.status(200).send("OK")
        })
        .catch(err => {
            console.log(err)
        })
        console.log("finish merge")
}

// passport.use(new FacebookStrategy(configAuth, 
// 	 (token, refreshToken, profile, done) => {
//          process.nextTick(function () {
//              return done(null, profile)
//          }
//     )}
// ))
         
passport.use(new FacebookStrategy(configAuth, 
	 (token, refreshToken, profile, done) => {
         process.nextTick(function () {
            console.log("Object is " + JSON.stringify(profile))
            const username = profile['_json']['first_name']+ profile['_json']['last_name'] + "@facebook"
            const email = profile['_json']['email']
            const avatar = profile['_json']['picture']['data']['url']
            console.log("avatar is " + avatar)
            User.findOne({ "auth.facebook": username }).exec()
            .then(user => {
                if(user) {
                    console.log(`${user} already exist.`)
                    return done(null, profile)
                } else {
                    const newUser = {}
                    newUser.auth = {"facebook" : username}
                    newUser.username = username
                    newUser.salt = ""
                    newUser.hash = ""
                    const newProfile = {}
                    newProfile.username = username
                    newProfile.email = email
                    newProfile.dob = new Date()
                    newProfile.zipcode = ""
                    newProfile.headline = ""
                    newProfile.following = []
                    newProfile.avatar = avatar
                    new User(newUser).save()
                    .then(doc => {
                        console.log('add user successfully! ', doc)
                        return doc
                    })
                    .then(doc => {
                        new Profile(newProfile).save()
                            .then(profile => {
                                console.log('add profile successfully! ', newProfile)
                            })
                        console.log("finish database!")
                        return doc
                    })
                    .then(doc => {
                        console.log("return donedonedone")
                        return done(null, profile)
                    })
                    console.log("not return!!!")

                }
            })
            .catch(err => {
                console.log("errrrrr")
                return done(err)
            })
            console.log("before return")
            // return done(null, profile)                  
         })
    })
)

const fbLogIn = (req, res) => {
    console.log("infblogin")
    console.log(`redirect to ${frontendUrl}`)
    res.redirect(frontendUrl)
}


const generateCode = (user) => {
	return md5("mySecretMessage" + new Date().getTime() + user.username)
}

const findFrontend = (req, res, next) => {
	frontendUrl = req.headers.referer;
	next();
}

const fail = (req, res) => {
    res.send(401, 'log in failed.')
}


const getAuthType = (req, res) => {
    const user = req.username
    const query = { username : user}
    User.findOne(query).exec()
        .then(doc => {
            if(doc==null) {
                User.findOne(query2).exec()
                    .then(doc => {
                        res.send({auth: doc.auth})
                    })
                    .catch(err => {
                        res.send(404, err)
                    })
            } else {
                res.send({auth: doc.auth})
            }
        })
        .catch(err => {
            res.send(404, err)
        })
}

const link2Normal = (req, res) => {
    let username = req.body.username
	let password = req.body.password
    let fbUser = req.body.logInUser
	if (!username || !password) {
		res.sendStatus(400)
		return
	}
	getUser(username, function (err, users) {
        if (!err) {
            if (users.length === 0) {
                console.log(`can\'t find user ${username}`)
                return
            } else {
                const userObj =  users[0]
                if (!userObj) {
                    // unauthorized
                    res.status(401).send('this username does not exist')
                    return
                }
                const hash = md5(userObj.salt + password)
                if (hash !== userObj.hash) {
                    // unauthorized
                    res.status(401).send('password is wrong')
                    return
                }
                mergeUser(fbUser, username, res)

            }
        } else {
            throw err
        }

    })
}

const unlinkAccount = (req, res) => {
    const query = { username : req.body.username}
    const update = { auth : {'normal' : req.body.username}}
    User.findOneAndUpdate(query, update, {new : true}).exec()
        .then(doc => {
            res.status(200).send("OK")
        })
        .catch(err => {
            res.send(404, err)
        })
}

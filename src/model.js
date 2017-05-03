// this is model.js 
const mongoose = require('mongoose')
require('./db.js')
mongoose.Promise = global.Promise
// console.log(mongoose.Promise)
exports.ObjectId = mongoose.Types.ObjectId

const commentSchema = new mongoose.Schema({
	commentId: String, author: String, date: Date, text: String
})

const authSchema = new mongoose.Schema({
    facebook: String,
    normal: String
})

const articleSchema = new mongoose.Schema({
	author: String, img: String, date: Date, text: String,
	comments: [ commentSchema ]
})



const profileSchema = new mongoose.Schema({
    username: String, headline: String, email: String,
    dob: Date, zipcode: String, avatar: String, following: [String]
})

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    dob: Date,
    zipcode: String,
    salt: String,
    hash: String,
    auth: authSchema
})

exports.Article = mongoose.model('article', articleSchema)
exports.Profile = mongoose.model('profile', profileSchema)
exports.User = mongoose.model('user', userSchema)
exports.Comment = mongoose.model('comment', commentSchema)

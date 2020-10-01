const express = require('express');
const router = express.Router();
const { User } = require("../models/User");
const { Product } = require('../models/Product');
const { auth, googlelogin ,facebooklogin } = require("../middleware/auth");
const { Payment } = require('../models/Payment');
const jwt = require('jsonwebtoken');
const async = require('async');
const nodemailer = require('nodemailer');
const config = require("../config/key");

const { use } = require('./product');

//=================================
//             User
//=================================

router.get("/auth", auth, (req, res) => {
    res.status(200).json({
        _id: req.user._id,
        isAdmin: req.user.role === 0 ? false : true,
        isAuth: true,
        email: req.user.email,
        name: req.user.name,
        lastname: req.user.lastname,
        role: req.user.role,
        image: req.user.image,
        cart: req.user.cart,
        history: req.user.history
    });
});

router.post("/register", (req, res) => {
    const {name,lastname,email,password} = req.body;
    console.log(lastname);
    User.findOne({email:email}).exec((err, user) => {
        if(user){
            return res.status(200).json({success:false, error: "User with given email already exists."})
        }
        else{

            const token = jwt.sign({name,email,password,lastname},'travelmernsecretkey',{expiresIn: '20m'});
            let transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: 'mykart.inc@gmail.com', // generated ethereal user
                    pass: config.emailPASSWORD // generated ethereal password
                },
                tls:{
                  rejectUnauthorized:false
                }
              });
            
              // setup email data with unicode symbols
              let mailOptions = {
                  from: '"My Kart" <your@email.com>', // sender address
                  to: req.body.email, // list of receivers
                  subject: 'Account Activation Link', // Subject line
                  html: `
                      <h2> Please click on given link to activate your account <h2>
                      <h4> This link will expire in 20 minutes <h4> 
                      <a href="http://localhost:3000/activate/${token}">Click Here</a>
                    ` // html body
              };
            
              // send mail with defined transport object
              transporter.sendMail(mailOptions, (error, info) => {
                if(error)
                    {
                        return res.json({
                            error: error.message
                        })
                    }
                    return res.json({success:true,message:"Account verification link sent at your email kindly activate your account by clicking on that link"})
          });
        }
    })
});

router.post("/dashboard/update" ,(req,res) =>{
    console.log(req.body);
    const {email , image , name , lastname } = req.body;
    User.findOne({email:email},(err,user) => {
        if(err)
        return res.status(200).json({err:err})
        else
        {
            user.image = image;
            user.name = name;
            user.lastname = lastname;
            user.save((err, doc) => {
                if (err) return res.json({ success:false ,err:err });
                return res.status(200).json({
                    success: true 
                });
            })
        }
    })
});

router.post("/authentication/activate/",(req,res)=>{
    const token = req.body.token;
    if(token){
        jwt.verify(token,'travelmernsecretkey',(err,decodedtoken) =>{
            if(err){
                return res.status(200).json({error:"Incorrect or Expired Token"})
            }
            else{
                const {name,email,password,lastname} = decodedtoken
                const user = new User({name,email,password,lastname});
                user.save((err, doc) => {
                if (err) return res.json({ success: false, err });
                return res.status(200).json({
                    success: true
                });
                });
            }
        })
    }
    else
    {
        return res.json({err:"Something went Wrong !!!"})
    }
})

router.post("/forgotpassword", (req,res) => {
    const {email} = req.body;
    User.findOne({email} , (err, user) =>{
        if(err)
        return res.status(200).json({error: err.errmsg})
        if(user)
        {
            const token = jwt.sign({_id:user._id},'travelmernsecretkeyforpasswordreset',{expiresIn: '20m'});
            let transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: 'mykart.inc@gmail.com', // generated ethereal user
                    pass: config.emailPASSWORD  // generated ethereal password
                },
                tls:{
                  rejectUnauthorized:false
                }
              });
            
              // setup email data with unicode symbols
              let mailOptions = {
                  from: '"My Kart" <your@email.com>', // sender address
                  to: req.body.email, // list of receivers
                  subject: 'Reset Password Link', // Subject line
                  html:`
                <h2> Please click on given link to Reset your Password <h2>
                <h4> This link will expire in 20 minutes <h4> 
                <a href="http://localhost:3000/resetpassword/${token}">Click Here</a>
                `};
                transporter.sendMail(mailOptions, (error, info) => {
                    if(error)
                        {
                            return res.json({
                                error: error.message
                            })
                        }
                        return res.json({success:true,message:"Password Reset Link sent at your email kindly activate your account by clicking on that link"})
              });
        }
        else
        return res.status(200).json({error: "User with this email does not exist"})
    })
})

router.post('/resetpassword',(req,res) =>{
    const {token,password} = req.body;
    if(token && password)
    {
        if(password.length < 6)
        return res.status(200).json({error:"Password must have more than 6 characters"})
        jwt.verify(token,'travelmernsecretkeyforpasswordreset',(err,decodedtoken) => {
            if(err)
            {
                return res.status(200).json({error:"Incorrect or Expired Token !!!"})
            }
            const {_id} = decodedtoken;
            User.findOne({_id:_id},(err,user) => {
                if(err)
                return res.status(200).json({error:err})
                else
                {
                    user.password = password
                    user.save((err, doc) => {
                        if (err) return res.json({ error:err });
                        return res.status(200).json({
                            success: true
                        });
                    })
                }
            })
        })
    }
    else{
        return res.status(200).json({error:"Password is Empty !!!"})
    }
})
router.post("/login", (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if (!user)
            return res.json({
                loginSuccess: false,
                message: "Auth failed, email not found"
            });

        user.comparePassword(req.body.password, (err, isMatch) => {
            if (!isMatch)
                return res.json({ loginSuccess: false, message: "Wrong password" });

            user.generateToken((err, user) => {
                if (err) return res.status(400).send(err);
                res.cookie("w_authExp", user.tokenExp);
                res
                    .cookie("w_auth", user.token)
                    .status(200)
                    .json({
                        loginSuccess: true, userId: user._id
                    });
            });
        });
    });
});

router.post("/googlelogin", googlelogin);
router.post("/facebooklogin", facebooklogin);

router.get("/logout", auth, (req, res) => {
    User.findOneAndUpdate({ _id: req.user._id }, { token: "", tokenExp: "" }, (err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).send({
            success: true
        });
    });
});


router.get('/addToCart', auth, (req, res) => {
    
    User.findOne({ _id: req.user._id }, (err, userInfo) => {
        let duplicate = false;
        let full = false;
        console.log(userInfo)

        userInfo.cart.forEach((item) => {
            if (item.id == req.query.productId) {
                duplicate = true;
                if(item.quantity >= req.query.stock)
                    full = true
            }
        })


        if (duplicate) {
            if(full)
                {
                    return res.json({ full: true});
                }
            User.findOneAndUpdate(
                { _id: req.user._id, "cart.id": req.query.productId },
                { $inc: { "cart.$.quantity": 1 } },
                { new: true },
                (err, userInfo) => {
                    if (err) return res.json({ success: false, err });
                    res.status(200).json(userInfo.cart)
                }
            )
        } else {
            User.findOneAndUpdate(
                { _id: req.user._id },
                {
                    $push: {
                        cart: {
                            id: req.query.productId,
                            quantity: 1,
                            date: Date.now()
                        }
                    }
                },
                { new: true },
                (err, userInfo) => {
                    if (err) return res.json({ success: false, err });
                    res.status(200).json(userInfo.cart)
                }
            )
        }
    })
});


router.get('/removeFromCart', auth, (req, res) => {

    User.findOneAndUpdate(
        { _id: req.user._id },
        {
            "$pull":
                { "cart": { "id": req.query._id } }
        },
        { new: true },
        (err, userInfo) => {
            let cart = userInfo.cart;
            let array = cart.map(item => {
                return item.id
            })

            Product.find({ '_id': { $in: array } })
                .populate('writer')
                .exec((err, cartDetail) => {
                    return res.status(200).json({
                        cartDetail,
                        cart
                    })
                })
        }
    )
})


router.get('/userCartInfo', auth, (req, res) => {
    User.findOne(
        { _id: req.user._id },
        (err, userInfo) => {
            let cart = userInfo.cart;
            let array = cart.map(item => {
                return item.id
            })


            Product.find({ '_id': { $in: array } })
                .populate('writer')
                .exec((err, cartDetail) => {
                    if (err) return res.status(400).send(err);
                    return res.status(200).json({ success: true, cartDetail, cart })
                })

        }
    )
})




router.post('/successBuy', auth, (req, res) => {
    let history = [];
    let transactionData = {};
    const mydate = new Date();
    //1.Put brief Payment Information inside User Collection 
    req.body.cartDetail.forEach((item) => {
        history.push({
            dateOfPurchase:`${mydate.getDate()} ${mydate.toLocaleString('default', { month: 'long' })} ${mydate.getFullYear()} at ${mydate.getHours()}:${mydate.getMinutes()}:${mydate.getSeconds()}`,
            name: item.title,
            id: item._id,
            price: item.price,
            quantity: item.quantity,
            paymentId: req.body.paymentData.paymentID
        })
    })

    //2.Put Payment Information that come from Paypal into Payment Collection 
    transactionData.user = {
        id: req.user._id,
        name: req.user.name,
        lastname: req.user.lastname,
        email: req.user.email
    }

    transactionData.data = req.body.paymentData;
    transactionData.product = history


    User.findOneAndUpdate(
        { _id: req.user._id },
        { $push: { history: history }, $set: { cart: [] } },
        { new: true },
        (err, user) => {
            if (err) return res.json({ success: false, err });


            const payment = new Payment(transactionData)
            payment.save((err, doc) => {
                if (err) return res.json({ success: false, err });

                //3. Increase the amount of number for the sold information 

                //first We need to know how many product were sold in this transaction for 
                // each of products

                let products = [];
                doc.product.forEach(item => {
                    products.push({ id: item.id, quantity: item.quantity })
                })

                // first Item    quantity 2
                // second Item  quantity 3

                async.eachSeries(products, (item, callback) => {
                    Product.update(
                        { _id: item.id },
                        {
                            $inc: {
                                "sold": item.quantity,
                                "stock": -item.quantity
                            }
                        },
                        { new: false },
                        (err,success)=>{
                            if(err) return res.status(200).json({err:err})
                            User.find({},(err,users) => {
                                if(err) return res.status(200).json({err:err})
                                users.forEach((user)=>{
                                    {
                                        User.findOne({'_id': { $in: [user] }})
                                        .exec((err,user)=>{
                                            if(err) return res.status(200).json({err:err})
                                            let cart = user.cart;
                                            let array = cart.map(item => {
                                                return ({ id:item.id,quantity:item.quantity})
                                            })
                                            array.forEach((item)=>{
                                                Product.findOne({'_id':item.id})
                                                .exec((err,ItemDetail)=>{
                                                    if (err) return res.status(400).send(err);
                                                    console.log(ItemDetail.stock)
                                                    if(item.quantity > ItemDetail.stock)
                                                    {
                                                        User.findOneAndUpdate({ '_id': user._id },{"$pull":{ "cart": { "id": item.id } }},{ new: false },
                                                            (err, userInfo) => {
                                                            if (err) return res.status(400).send(err); 
                                                            })
                                                    }
                                                })
                                            })
                                        })
                                    }
                                })
                            })
                            .exec((err,success)=>{
                                res.status(200).json({
                                    success: true,
                                    cart: user.cart,
                                    cartDetail: []
                                })
                            })
                        }
                    )
                }, (err) => {
                    if (err) return res.json({ success: false, err })
                })

            })
        }
    )
})


router.get('/getHistory', auth, (req, res) => {
    User.findOne(
        { _id: req.user._id },
        (err, doc) => {
            let history = doc.history;
            if (err) return res.status(400).send(err)
            return res.status(200).json({ success: true, history })
        }
    )
})


module.exports = router;

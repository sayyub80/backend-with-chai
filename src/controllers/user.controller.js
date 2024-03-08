import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiErrors.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

//Register 
const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {username,fullName, email,  password } = req.body
    console.log("email: ", email);
    
    
    if ( [fullName, email, username, password].some((field) => field?.trim()=== "")        // The some() method executes the callback function once for each array element.
    ) {
        throw new ApiError(400, "All fields are required")
        
    } 
 
    const existedUser =await User.findOne({
        $or: [{ username }, { email }]
    })
  
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
     
   
    const avatarLocalPath =req.files?.avatar?.[0]?.path; 
    const coverImageLocalPath = req.files?.coverImage?.[0].path;  //coverImage?. This will ensure coverImage exists before trying to access its index,
    console.log(!avatarLocalPath); 
  
    if(!avatarLocalPath){ 
        throw new ApiError(400,"Avatar file is required ")
    }
 
    //upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
     console.log(avatar)
    if(!avatar){
        throw new ApiError(401,"Avatar file is required ")
    }



    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username:username.toLowerCase()

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"       // we write here which we don't required 
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

 } )




 //Login
 const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body
    
    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }

    //here is an alternative of above code 
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
    // }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }
 
   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,   //by porviding true cookies can be only modified by server not by frontend 
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken  // we already send access and refresh token to cookies so why here bcz yha pe ham wo case handle kar rhe he jaha pe user khud apni taraf se token ko save karna chah rha h 
            },
            "User logged In Successfully"
        )
    )

})

//logout
const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})


//refreshAccessToken
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken){
          throw new ApiError(401, "unauthorized request")
}

try {
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user = await User.findById(decodedToken?._id)

    if (!user) {
        throw new ApiError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used")

    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {accessToken, refreshToken: newRefreshToken},
            "Access token refreshed"
        )
    )
} catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
}

})
 

//updatePassword
const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body



    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})


//get current user 
const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, 'Current user fetched successfully'));
})


//update acc details
const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}

    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});


//update avatar
const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")

    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})


//update coverImage
const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")

    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})


//
const getUserChannelProfile = asyncHandler(async (req,res)=>{
   const {username} =   req.params

   if(!username?.trim()){
    throw new ApiError(400,"username is missing")
   }

    const channel= await User.aggregate([
           {
              $match:{
                username:username?.toLowerCase()
              }
           },
           {
              $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
              }
           },
           {
            $lookup:{
              from:"subscriptions",
              localField:"_id",
              foreignField:"subscriber",
              as:"subscribedTo"
            }
         },
         {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                 channelSubscribedToCount:{
                    $size:"subscribedTo"
                 },
                  isSubscribed:{
                     $cond:{
                        if:{$in:[req.user?._id, "$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                    }
                 
            }
         },
         {
             $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1

             }
         }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel doesn't exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})




 export {
 registerUser,
 loginUser,
 logoutUser,
 refreshAccessToken,
 changeCurrentPassword,
 getCurrentUser,
 updateAccountDetails,
 updateUserAvatar,
 updateUserCoverImage,
 getUserChannelProfile

} 
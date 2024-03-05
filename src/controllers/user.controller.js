import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiErrors.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

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


 export {
 registerUser,
 loginUser,
 logoutUser
} 
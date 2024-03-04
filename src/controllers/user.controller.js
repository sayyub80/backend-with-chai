import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiErrors.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

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
    
    
    if ( 
        [fullName, email, username, password].some((field) => field?.trim()=== "")        // The some() method executes the callback function once for each array element.
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

 export {registerUser} 
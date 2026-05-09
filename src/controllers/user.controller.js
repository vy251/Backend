import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiErrror.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";

// console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
// console.log("API_KEY:", process.env.CLOUDINARY_API_KEY);
// console.log("API_SECRET:", process.env.CLOUDINARY_API_SECRET);

const registerUser=asyncHandler(async(req,res)=>{
    const {fullname,username,email,password}=req.body;
    console.log("fullname:",fullname);
    console.log("password:",password);
    console.log("email:",email);
    console.log("username:",username);
    
    if(
       [fullname,email,username,password].some((field)=>{
        return field?.trim()==="";
       })
    ) {
        throw new ApiError(400,"All fields are required")
    }
    
    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })
    
    if(existedUser){
        throw new ApiError(409,"User with email or username already exists");
    }

    const avatarfile = req.files?.avatar?.[0];
    const coverImagefile= req.files?.coverImage?.[0];

    const avatarLocalPath = avatarfile?.path;
    const coverImageLocalPath = coverImagefile?.path;

    // console.log(req.files);

    console.log("avatarLocalPath:", avatarLocalPath);
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }
    
    const avatar=await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);

    // console.log(avatar);
    
    if(!avatar){
        throw new ApiError(400,"Avatar file is required");
    }

    const user=await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        username:username.toLowerCase(),
        email,
        password
    })
    
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    
    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registered successflly")
    )

})  

export {registerUser};
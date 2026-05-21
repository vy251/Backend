import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiErrror.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
// console.log("API_KEY:", process.env.CLOUDINARY_API_KEY);
// console.log("API_SECRET:", process.env.CLOUDINARY_API_SECRET);

const generateAccessAndRefreshTokens = async(userId)=>
    {
    try{
       const user = await User.findById(userId)
       const accessToken=user.generateAccessToken()
       const refreshToken=user.generateRefreshToken()

       user.refreshToken=refreshToken;
       await user.save({validateBeforeSave:false})
       
       return {accessToken,refreshToken};
    }
    catch(error){
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}

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

const loginUser=asyncHandler(async(req,res)=>{
      const {email,username,password}=req.body;
      
      if(!username && !email){
        throw new ApiError(400,"username or email is required")
      }

      const user=await User.findOne({
        $or:[{username},{email}]
      })

      if(!user){
        throw new ApiError(404,"User does not Exist");
      }
      
      console.log("Entered Password:", password);
      console.log("Stored Password:", user.password);

      const isPasswordValid=await user.isPasswordCorrect(password);

      if(!isPasswordValid){
        throw new ApiError(401,"Password is Incorrect");
      }

      const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)
      const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

      const options={
        httpOnly:true,
        secure:true
      }

      return res
      .status(200).cookie("accessToken",accessToken,options)
      .cookie("refreshToken",refreshToken,options)
      .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully"
        )
      )
})

const logoutUser=asyncHandler(async(req,res)=>{
      await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            },
        },
        {
                new:true
        }
      )
      
      const options={
        httpOnly:true,
        secure:true
      }

      return res
      .status(200)
      .clearCookie("accessToken",options)
      .clearCookie("refreshToken",options)
      .json(new ApiResponse(200,{},"User logged Out"));
      
})

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request");
    }

    try {
        const decodedToken=jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user=await User.findById(decodedToken?._id)
    
       if(!user){
            throw new ApiError(401,"Invalid refresh token");
        }
    
        if(incomingRefreshToken!=user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
      const {oldPassword,newPassword}=req.body;
      
      const user=await User.findById(req.user?._id)
      const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
      
      if(!isPasswordCorrect){
        throw new ApiError(400,"Old password is incorrect");
      }

      user.password=newPassword;
      await user.save({validateBeforeSave:false})

      return res
      .status(200)
      .json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser=asyncHandler(async(req,res)=>{
      return res
      .status(200)
      .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
})
const updateAccountDetails=asyncHandler(async(req,res)=>{
      const {fullname,email}=req.body;

      if(!fullname || !email){
        throw new ApiError(400,"fullname and email are required");
      }

      const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar=asyncHandler(async(req,res)=>{
      const avatarLocalPath=req.file?.path

      if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
      }

      const avatar=await uploadOnCloudinary(avatarLocalPath);

      if(!avatar.url){
        throw new ApiError(500,"Something went wrong while uploading the avatar");
      }

      const useravatar=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
      ).select("-password")

      return res
      .status(200)
      .json(new ApiResponse(200,useravatar,"Avatar updated successfully"))
})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
      const coverImagePath=req.file?.path

      if(!coverImagePath){
        throw new ApiError(400,"Cover image file is required")
      }

      const coverImage=await uploadOnCloudinary(coverImagePath);

      if(!coverImage.url){
        throw new ApiError(500,"Something went wrong while uploading the cover image");
      }

      const usercoverimage=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
      ).select("-password")

      return res
      .status(200)
      .json(new ApiResponse(200,usercoverimage,"Cover image updated successfully"))
})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
      const {username}=req.params;

      if(!username?.trim()){
        throw new ApiError(400,"Username is required");
      }

      const channel=await User.aggregate([
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
                subscribersCount:{$size:"$subscribers"},
                subscribedToCount:{$size:"$subscribedTo"},
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },{
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                subscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
      ])
      
      if(!channel?.length){
         throw new ApiError(404,"Channel not found");
      }

      return res
      .status(200)
      .json(new ApiResponse(200,channel[0],"User channel fetched successfully"))
})

export {registerUser,loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateUserAvatar,updateUserCoverImage,updateAccountDetails,getUserChannelProfile};
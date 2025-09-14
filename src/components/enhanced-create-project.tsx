"use client";

import { createVideoWithConfig } from "@/action/create-video-action";
import TooltipCredits from "@/components/global/credit-button";
import { ShineBorder } from "@/components/magicui/shine-border";
import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiStepLoader as Loader } from "@/components/ui/multi-step-loader";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { VideoConfiguration, VideoConfig } from "@/components/video-configuration";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const EnhancedCreateProjectPage = ({
  user,
  credits,
}: {
  user: string | null;
  credits: number;
}) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    duration: '30',
    imageCount: 5,
    aspectRatio: '9:16'
  });

  const getLoadingStates = (config: VideoConfig) => {
    const baseStates = [
      { text: "Generating Context" },
      { text: "Generating Image Scripts" },
    ];

    // Dynamic image generation states based on config
    const imageStates = Array.from({ length: config.imageCount }, (_, i) => ({
      text: `Generating Image ${i + 1}`
    }));

    const endStates = [
      { text: "Generating Audio Script" },
      { text: "Generating Audio" },
      { text: "Generating Captions" },
      { text: "Combining it All" },
      { text: "Almost done" },
      { text: "Completed, redirecting" },
    ];

    return [...baseStates, ...imageStates, ...endStates];
  };

  const placeholders = [
    "What's the first rule of Fight Club?",
    "Who is Tyler Durden?",
    "Where is Andrew Laeddis Hiding?",
    "Write a Javascript method to reverse a string",
    "How to assemble your own PC?",
  ];

  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateVideo = async (prompt: string) => {
    setIsLoading(true);
    try {
        console.log("Starting video creation with prompt:", prompt, "Config:", videoConfig);
        const result = await createVideoWithConfig(prompt, videoConfig);

        if (result?.videoId) {
            console.log("Video ID created:", result.videoId);
            let pollAttempts = 0;
            const maxAttempts = 120; // 10 minutes max with 5-second intervals

            const pollInterval = setInterval(async () => {
                pollAttempts++;

                try {
                    const response = await fetch(`/api/video-status/${result.videoId}`);
                    const data = await response.json();

                    console.log(`Poll attempt ${pollAttempts}:`, data);

                    if (data.completed) {
                        console.log("✅ Video completed!");
                        clearInterval(pollInterval);
                        router.replace(`/videos/${result.videoId}`);
                    } else if (data.failed) {
                        console.error("❌ Video generation failed");
                        clearInterval(pollInterval);
                        setIsLoading(false);
                        alert("Video generation failed. Please try again.");
                    } else if (pollAttempts >= maxAttempts) {
                        console.error("⏰ Polling timeout");
                        clearInterval(pollInterval);
                        setIsLoading(false);
                        alert("Video generation is taking longer than expected. Please check back later.");
                    }
                } catch (error) {
                    console.log("Still processing...", error);
                }
            }, 5000);
        } else {
            setIsLoading(false);
            alert("Failed to create video. Please try again.");
        }
    } catch (error) {
        setIsLoading(false);
        console.error("Failed to create video:", error);
        alert("An error occurred. Please try again.");
    }
  };

  const getEstimatedCost = (config: VideoConfig): number => {
    // Base cost calculation based on configuration
    let baseCost = 1; // Default 1 credit

    // Additional cost for longer videos
    if (config.duration === '60') baseCost += 1;

    // Additional cost for more images
    if (config.imageCount > 5) baseCost += Math.ceil((config.imageCount - 5) * 0.2);

    return baseCost;
  };

  const estimatedCost = getEstimatedCost(videoConfig);

  return (
    <div className="w-screen min-h-screen flex flex-col">
      <div className="w-full flex justify-between items-center py-4 px-10">
        <Link href={"/new"}>
          <div className="font-bold text-xl bg-linear-to-br from-blue-500 via-rose-500 to-purple-500 bg-clip-text text-transparent">
            AI-Powered Shorts
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href={"/classic"}>
            <Button variant="outline" size="sm" className="text-xs">
              Classic Mode
            </Button>
          </Link>
          {!user && (
            <div>
              <SignInButton>
                <Button className="bg-black border border-gray-400 text-white rounded-full mx-2 hover:bg-gray-900 transition-colors duration-150 cursor-pointer">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer">
                  Sign up
                </Button>
              </SignUpButton>
            </div>
          )}
          {user && (
            <div className="flex justify-end mr-7 mt-5">
              <TooltipCredits credits={credits} />
              <Link href={"/dashboard"}>
                <Button className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium mx-2 cursor-pointer">
                  Dashboard
                </Button>
              </Link>
              <UserButton />
            </div>
          )}
        </div>
      </div>

      <Loader
        key={isLoading ? "loading" : "idle"}
        loadingStates={getLoadingStates(videoConfig)}
        loading={isLoading}
        duration={parseInt(videoConfig.duration) * 500} // Adjust duration based on video length
        loop={false}
      />

      <h1 className="text-4xl md:text-4xl lg:text-6xl font-semibold max-w-7xl mx-auto text-center mt-6 relative z-20 py-6 bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-700 dark:from-neutral-800 dark:via-white dark:to-white">
        Generate realistic short
        <div className="h-6"></div>
        <Cover>warp speed</Cover>
      </h1>

      <div className="flex flex-col items-center mt-auto mb-20">
        {/* Video Configuration Section */}
        <div className="w-full max-w-4xl mb-8">
          <div className="flex justify-center mb-4">
            <Button
              variant="outline"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-2 rounded-full border-gray-300 hover:border-gray-400 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {showAdvancedOptions ? 'Hide' : 'Show'} Video Settings
              {showAdvancedOptions ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>

          {showAdvancedOptions && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-lg">
              <VideoConfiguration
                config={videoConfig}
                onConfigChange={setVideoConfig}
                className="max-w-3xl mx-auto"
              />
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="relative">
          <div className="relative rounded-3xl w-[500px] overflow-hidden">
            <ShineBorder
              className="z-10"
              shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
            />
            <PlaceholdersAndVanishInput
              placeholders={placeholders}
              onChange={(e) => setPrompt(e.target.value)}
              onSubmit={(e) => {
                e.preventDefault();
                if (!user) {
                  return setTimeout(() => setShowLoginDialog(true), 1000);
                }
                if (credits < estimatedCost) {
                  return setTimeout(() => setShowCreditsDialog(true), 700);
                }
                setTimeout(() => handleCreateVideo(prompt), 1000);
              }}
            />
          </div>

          {/* Cost Display */}
          <div className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <span>Estimated cost: {estimatedCost} credit{estimatedCost > 1 ? 's' : ''}</span>
              {estimatedCost > 1 && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  Premium settings
                </span>
              )}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {videoConfig.duration}s video • {videoConfig.imageCount} images • {videoConfig.aspectRatio} format
            </div>
          </div>
        </div>

        {/* Login Dialog */}
        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="sm-max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Hello There!</DialogTitle>
              <DialogDescription>
                Please sign in to create videos
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <SignInButton>
                <Button className="bg-black border border-gray-400 text-white rounded-full mx-2 hover:bg-gray-900 transition-colors duration-150 cursor-pointer">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer">
                  Sign up
                </Button>
              </SignUpButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Credits Dialog */}
        <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                <div className="text-red-500">Insufficient Credits</div>
              </DialogTitle>
              <DialogDescription>
                You need {estimatedCost} credits to create this video, but you only have {credits} credits.
                {estimatedCost > 1 && (
                  <div className="mt-2 text-sm text-gray-600">
                    💡 Try using default settings to reduce the cost to 1 credit.
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer"
                onClick={() => {
                  router.push("/pricing");
                  setShowCreditsDialog(false);
                }}
              >
                Get More Credits
              </Button>
              <Button
                variant="outline"
                className="rounded-full cursor-pointer"
                onClick={() => setShowCreditsDialog(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EnhancedCreateProjectPage;

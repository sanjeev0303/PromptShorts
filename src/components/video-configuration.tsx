"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock, Image, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface VideoConfig {
  duration: '15' | '30' | '60'
  imageCount: 3 | 4 | 5 | 6 | 8
  aspectRatio: '9:16' | '16:9' | '1:1'
}

interface VideoConfigurationProps {
  config: VideoConfig
  onConfigChange: (config: VideoConfig) => void
  className?: string
}

const durationOptions = [
  { value: '15', label: '15 seconds', description: 'Quick & Snappy', scenes: 3, sceneDuration: 5 },
  { value: '30', label: '30 seconds', description: 'Perfect Balance', scenes: 5, sceneDuration: 6 },
  { value: '60', label: '60 seconds', description: 'Detailed Story', scenes: 8, sceneDuration: 7.5 }
] as const

const imageCountOptions = [
  { value: 3, label: '3 Images', description: 'Minimal & Clean', bestFor: '15s videos' },
  { value: 4, label: '4 Images', description: 'Balanced Flow', bestFor: '15-30s videos' },
  { value: 5, label: '5 Images', description: 'Rich Narrative', bestFor: '30s videos' },
  { value: 6, label: '6 Images', description: 'Detailed Story', bestFor: '30-60s videos' },
  { value: 8, label: '8 Images', description: 'Cinematic', bestFor: '60s videos' }
] as const

const aspectRatioOptions = [
  { value: '9:16', label: 'Portrait (9:16)', description: 'TikTok, Instagram Reels', icon: '📱' },
  { value: '16:9', label: 'Landscape (16:9)', description: 'YouTube, Desktop', icon: '🖥️' },
  { value: '1:1', label: 'Square (1:1)', description: 'Instagram Posts', icon: '⏹️' }
] as const

export const VideoConfiguration: React.FC<VideoConfigurationProps> = ({
  config,
  onConfigChange,
  className = ''
}) => {
  const currentDurationOption = durationOptions.find(opt => opt.value === config.duration)
  const currentImageOption = imageCountOptions.find(opt => opt.value === config.imageCount)
  const currentAspectOption = aspectRatioOptions.find(opt => opt.value === config.aspectRatio)

  const getRecommendedImageCount = (duration: string): number => {
    switch (duration) {
      case '15': return 3
      case '30': return 5
      case '60': return 8
      default: return 5
    }
  }

  const handleDurationChange = (duration: '15' | '30' | '60') => {
    const recommendedImageCount = getRecommendedImageCount(duration)
    onConfigChange({
      ...config,
      duration,
      imageCount: recommendedImageCount as VideoConfig['imageCount']
    })
  }

  const isImageCountRecommended = (count: number, duration: string): boolean => {
    return getRecommendedImageCount(duration) === count
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Video Duration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-blue-500" />
            Video Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={config.duration}
            onValueChange={handleDurationChange}
            className="space-y-3"
          >
            {durationOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <RadioGroupItem value={option.value} id={`duration-${option.value}`} />
                <Label
                  htmlFor={`duration-${option.value}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {option.scenes} scenes × {option.sceneDuration}s each
                      </div>
                    </div>
                    {config.duration === option.value && (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        Selected
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Number of Images */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Image className="w-5 h-5 text-green-500" />
            Number of Images
            <Badge variant="outline" className="text-xs">
              {currentDurationOption?.scenes} scenes total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={config.imageCount.toString()}
            onValueChange={(value: string) => onConfigChange({
              ...config,
              imageCount: parseInt(value) as VideoConfig['imageCount']
            })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select number of images" />
            </SelectTrigger>
            <SelectContent>
              {imageCountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        {option.bestFor}
                      </Badge>
                      {isImageCountRecommended(option.value, config.duration) && (
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                          Recommended
                        </Badge>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentImageOption && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-700">
                <strong>{currentImageOption.label}:</strong> {currentImageOption.description}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Best for: {currentImageOption.bestFor}
              </div>
              {!isImageCountRecommended(config.imageCount, config.duration) && (
                <div className="text-xs text-amber-600 mt-2 font-medium">
                  ⚠️ Consider using {getRecommendedImageCount(config.duration)} images for {config.duration}s videos for optimal pacing
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aspect Ratio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-purple-500" />
            Aspect Ratio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={config.aspectRatio}
            onValueChange={(value: string) => onConfigChange({
              ...config,
              aspectRatio: value as VideoConfig['aspectRatio']
            })}
            className="space-y-3"
          >
            {aspectRatioOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <RadioGroupItem value={option.value} id={`aspect-${option.value}`} />
                <Label
                  htmlFor={`aspect-${option.value}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{option.icon}</span>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-gray-600">{option.description}</div>
                      </div>
                    </div>
                    {config.aspectRatio === option.value && (
                      <Badge variant="default" className="bg-purple-100 text-purple-800">
                        Selected
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-blue-800">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Duration:</span>
              <div className="text-blue-800 font-semibold">{config.duration} seconds</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Images:</span>
              <div className="text-green-800 font-semibold">{config.imageCount} images</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Scenes:</span>
              <div className="text-purple-800 font-semibold">{currentDurationOption?.scenes} scenes</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Format:</span>
              <div className="text-orange-800 font-semibold">{currentAspectOption?.label}</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
            <div className="text-xs text-gray-600">
              <strong>Scene Duration:</strong> ~{currentDurationOption?.sceneDuration}s per scene
            </div>
            <div className="text-xs text-gray-600 mt-1">
              <strong>Images per Scene:</strong> ~{(config.imageCount / (currentDurationOption?.scenes || 1)).toFixed(1)} images per scene
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

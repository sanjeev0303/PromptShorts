"use client"

import { deleteVideo } from "@/lib/delete-video"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface UseVideoActionsProps {
    videoId: string
    videoUrl: string | null
    onDeleteSuccess?: () => void
}

export const useVideoActions = ({ videoId, videoUrl, onDeleteSuccess }: UseVideoActionsProps) => {
    const router = useRouter()
    const [copied, setCopied] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDownload = async () => {
        if (!videoUrl) {
            toast.error("Download Failed", {
                description: "Video file is not available for download."
            })
            return
        }

        try {
            const loadingToast = toast.loading('Preparing download...', {
                description: "Please wait while we prepare your video file."
            })

            // Create download link
            const response = await fetch(`/api/download/${videoId}`)

            if (!response.ok) {
                throw new Error('Download request failed')
            }

            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)

            const a = document.createElement('a')
            a.href = downloadUrl
            a.download = `video-${videoId}.mp4`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)

            // Clean up the blob URL
            window.URL.revokeObjectURL(downloadUrl)

            toast.dismiss(loadingToast)
            toast.success('Download Complete', {
                description: 'Your video has been saved to your device.'
            })

        } catch (error) {
            console.error('Download error:', error)
            toast.error('Download Failed', {
                description: "Unable to download the video. Please try again or contact support."
            })
        }
    }

    const handleCopyLink = async () => {
        try {
            const shareUrl = `${window.location.origin}/videos/${videoId}`
            await navigator.clipboard.writeText(shareUrl)

            setCopied(true)
            setTimeout(() => setCopied(false), 2000)

            toast.success('Link Copied', {
                description: "Video link has been copied to your clipboard."
            })
        } catch (error) {
            console.error('Copy error:', error)

            // Fallback for older browsers
            try {
                const shareUrl = `${window.location.origin}/videos/${videoId}`
                const textArea = document.createElement('textarea')
                textArea.value = shareUrl
                textArea.style.position = 'fixed'
                textArea.style.left = '-999999px'
                textArea.style.top = '-999999px'
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                document.execCommand('copy')
                textArea.remove()

                setCopied(true)
                setTimeout(() => setCopied(false), 2000)

                toast.success('Link Copied', {
                    description: "Video link has been copied to your clipboard."
                })
            } catch (fallbackError) {
                toast.error("Copy Failed", {
                    description: "Unable to copy link to clipboard. Please copy the URL manually."
                })
            }
        }
    }

    const handleDelete = async () => {
        if (isDeleting) return // Prevent double-clicks

        setIsDeleting(true)

        try {
            // Show confirmation toast first
            const confirmToast = toast.loading('Deleting video...', {
                description: "This action cannot be undone."
            })

            const result = await deleteVideo(videoId)

            toast.dismiss(confirmToast)

            if (!result) {
                // Successful deletion (null response indicates success in your implementation)
                toast.success("Video Deleted", {
                    description: "Your video has been permanently removed."
                })

                if (onDeleteSuccess) {
                    onDeleteSuccess()
                } else {
                    router.refresh()
                }
            } else if (result.success === false) {
                toast.error("Deletion Failed", {
                    description: result.error || 'Unable to delete the video. Please try again.'
                })
            }

        } catch (error) {
            console.error('Delete error:', error)
            toast.error("Deletion Failed", {
                description: "An unexpected error occurred. Please try again or contact support."
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/videos/${videoId}`

        if (navigator.share && navigator.canShare()) {
            try {
                await navigator.share({
                    title: 'Check out this AI-generated video',
                    text: 'Amazing video created with AI!',
                    url: shareUrl,
                })

                toast.success('Shared Successfully', {
                    description: 'Video link has been shared.'
                })
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    // Fallback to copy link if sharing fails
                    await handleCopyLink()
                }
            }
        } else {
            // Fallback to copy link if Web Share API is not available
            await handleCopyLink()
        }
    }

    return {
        handleDownload,
        handleCopyLink,
        handleDelete,
        handleShare,
        isDeleting,
        copied
    }
}

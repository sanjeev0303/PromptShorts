import React from 'react'
import { Composition } from 'remotion'
import { MyComposition } from './composition'

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="MyVideo"
                component={MyComposition}
                fps={30}
                width={1080}
                height={1920}
                calculateMetadata={async ({ props }: { props: any }) => {
                    return {
                        durationInFrames: typeof props.durationInFrames === 'number' ? props.durationInFrames : 0
                    }
                }}
            />
        </>
    )
}

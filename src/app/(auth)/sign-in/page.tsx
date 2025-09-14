import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <SignIn
            routing="hash"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
        />
    )
}

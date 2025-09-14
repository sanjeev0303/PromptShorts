import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
    return (
        <SignUp
            routing="hash"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
        />
    )
}

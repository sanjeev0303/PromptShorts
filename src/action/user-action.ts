"use server"

import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";

export const checkUser = async () => {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    // Now get the full user object only if we have a userId
    const user = await currentUser();

    if (!user) {
      return null;
    }

    const email = user.emailAddresses[0]?.emailAddress;

    if (!email) {
      console.error("No email found for user");
      return null;
    }

    // Use upsert to handle race conditions elegantly
    await prisma.user.upsert({
      where: { userId: userId },
      create: {
        userId: userId,
        email: email,
      },
      update: {
        email: email, // Update email in case it changed
      },
    });

    return userId;
  } catch (error) {
    console.error("Error in checkUser:", error);
    return null;
  }
};

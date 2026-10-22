"use client";

import { createContext, useContext } from "react";

const noChange = () => {};
type ProfileFormState = {
  resetKey: number;
  resetValues: Record<string, string>;
  markChanged: () => void;
};
const ProfileFormContext = createContext<ProfileFormState>({ resetKey: 0, resetValues: {}, markChanged: noChange });

export function useProfileFormState() {
  return useContext(ProfileFormContext);
}

export { ProfileFormContext };

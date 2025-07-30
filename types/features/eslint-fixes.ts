// Common type definitions to replace 'any'
// Export all types to prevent unused warnings
export {}
// Copy these to the appropriate files

// For event handlers:
export type ChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
export type FormEvent = React.FormEvent<HTMLFormElement>;
export type MouseEvent = React.MouseEvent<HTMLButtonElement>;

// For API/Database:
export type DatabaseRecord = Record<string, unknown>;
export type ApiResponse<T = unknown> = {
  data?: T;
  error?: string | { message: string };
  success: boolean;
};

// For Firebase:
export type FirebaseError = {
  code: string;
  message: string;
  name: string;
};

// For unknown objects:
export type UnknownObject = Record<string, unknown>;
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

/**
 * Runtime-safe database shape until generated Supabase types are checked in.
 * Replace this with `supabase gen types typescript` output after linking a
 * project; using a string index keeps server integration code buildable now.
 */
export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: Json }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}

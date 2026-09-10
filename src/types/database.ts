// Generated from the Supabase project schema (supabase gen types typescript).
// Regenerate with `bun run db:types` after changing the migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      categories: {
        Row: {
          active: boolean;
          created_at: string;
          emoji: string;
          id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          emoji?: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          emoji?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          invited_by: string | null;
          role: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          invited_by?: string | null;
          role?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          invited_by?: string | null;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      kharcha: {
        Row: {
          amount: number;
          category: string;
          category_icon: string | null;
          created_at: string;
          expense_date: string;
          id: string;
          note: string | null;
          owner_id: string;
          receipt_path: string | null;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          amount: number;
          category: string;
          category_icon?: string | null;
          created_at?: string;
          expense_date: string;
          id?: string;
          note?: string | null;
          owner_id: string;
          receipt_path?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          category_icon?: string | null;
          created_at?: string;
          expense_date?: string;
          id?: string;
          note?: string | null;
          owner_id?: string;
          receipt_path?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kharcha_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      kharcha_shares: {
        Row: {
          created_at: string;
          kharcha_id: string;
          shared_by: string;
          shared_with: string;
        };
        Insert: {
          created_at?: string;
          kharcha_id: string;
          shared_by: string;
          shared_with: string;
        };
        Update: {
          created_at?: string;
          kharcha_id?: string;
          shared_by?: string;
          shared_with?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kharcha_shares_kharcha_id_fkey';
            columns: ['kharcha_id'];
            isOneToOne: false;
            referencedRelation: 'kharcha';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kharcha_shares_shared_by_fkey';
            columns: ['shared_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kharcha_shares_shared_with_fkey';
            columns: ['shared_with'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          disabled: boolean;
          display_name: string | null;
          email: string;
          email_lower: string | null;
          id: string;
          role: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          disabled?: boolean;
          display_name?: string | null;
          email: string;
          email_lower?: string | null;
          id: string;
          role?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          disabled?: boolean;
          display_name?: string | null;
          email?: string;
          email_lower?: string | null;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_kharcha: { Args: { k_id: string }; Returns: boolean };
      is_active_member: { Args: never; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      is_shared_with_me: { Args: { k_id: string }; Returns: boolean };
      owns_kharcha: { Args: { k_id: string }; Returns: boolean };
      safe_uuid: { Args: { value: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

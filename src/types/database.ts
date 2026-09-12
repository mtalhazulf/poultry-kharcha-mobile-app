// Generated via `supabase gen types typescript` (mcp__claude_ai_Supabase__generate_typescript_types)
// through supabase/migrations/20260912040000_expense_history_and_org_visibility.sql.
// Omitted on purpose: trigger functions and internal SQL helpers that clients cannot
// execute (generate_invite_code, assign_invite_code, snapshot_kharcha_history).
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
          icon: string;
          id: string;
          name: string;
          org_id: string;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          icon?: string;
          id?: string;
          name: string;
          org_id: string;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          icon?: string;
          id?: string;
          name?: string;
          org_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
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
          org_id: string;
          owner_id: string;
          receipt_path: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          category: string;
          category_icon?: string | null;
          created_at?: string;
          expense_date: string;
          id?: string;
          note?: string | null;
          org_id: string;
          owner_id: string;
          receipt_path?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          category_icon?: string | null;
          created_at?: string;
          expense_date?: string;
          id?: string;
          note?: string | null;
          org_id?: string;
          owner_id?: string;
          receipt_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kharcha_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kharcha_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      kharcha_history: {
        Row: {
          amount: number;
          category: string;
          category_icon: string | null;
          edited_at: string;
          edited_by: string;
          expense_date: string;
          id: string;
          kharcha_id: string;
          note: string | null;
          receipt_path: string | null;
          version: number;
        };
        Insert: {
          amount: number;
          category: string;
          category_icon?: string | null;
          edited_at?: string;
          edited_by: string;
          expense_date: string;
          id?: string;
          kharcha_id: string;
          note?: string | null;
          receipt_path?: string | null;
          version: number;
        };
        Update: {
          amount?: number;
          category?: string;
          category_icon?: string | null;
          edited_at?: string;
          edited_by?: string;
          expense_date?: string;
          id?: string;
          kharcha_id?: string;
          note?: string | null;
          receipt_path?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'kharcha_history_edited_by_fkey';
            columns: ['edited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kharcha_history_kharcha_id_fkey';
            columns: ['kharcha_id'];
            isOneToOne: false;
            referencedRelation: 'kharcha';
            referencedColumns: ['id'];
          },
        ];
      };
      kharcha_views: {
        Row: {
          id: string;
          kharcha_id: string;
          read_at: string | null;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          kharcha_id: string;
          read_at?: string | null;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          kharcha_id?: string;
          read_at?: string | null;
          user_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kharcha_views_kharcha_id_fkey';
            columns: ['kharcha_id'];
            isOneToOne: false;
            referencedRelation: 'kharcha';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'kharcha_views_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      khata_entries: {
        Row: {
          amount: number;
          created_at: string;
          entry_date: string;
          id: string;
          note: string | null;
          org_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          entry_date?: string;
          id?: string;
          note?: string | null;
          org_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          entry_date?: string;
          id?: string;
          note?: string | null;
          org_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'khata_entries_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'khata_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_invite_codes: {
        Row: {
          code: string;
          org_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          code: string;
          org_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          org_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_invite_codes_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invite_codes_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_members: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          org_id: string;
          requested_at: string;
          role: string;
          status: string;
          user_id: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          org_id: string;
          requested_at?: string;
          role?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          org_id?: string;
          requested_at?: string;
          role?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_created_by_fkey';
            columns: ['created_by'];
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
          display_name: string | null;
          email: string;
          email_lower: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          email_lower?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          email_lower?: string | null;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_join_request: {
        Args: { p_org: string; p_user: string };
        Returns: undefined;
      };
      assign_invite_code: {
        Args: { p_actor: string; p_org: string };
        Returns: string;
      };
      can_access_kharcha: { Args: { p_kharcha: string }; Returns: boolean };
      create_organization: {
        Args: { p_name: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          name: string;
          updated_at: string;
        };
      };
      decline_join_request: {
        Args: { p_org: string; p_user: string };
        Returns: undefined;
      };
      generate_invite_code: { Args: Record<PropertyKey, never>; Returns: string };
      has_org_membership: { Args: { p_org: string }; Returns: boolean };
      is_org_admin: { Args: { p_org: string }; Returns: boolean };
      is_org_member: { Args: { p_org: string }; Returns: boolean };
      leave_organization: { Args: { p_org: string }; Returns: undefined };
      owns_kharcha: { Args: { p_kharcha: string }; Returns: boolean };
      regenerate_invite_code: { Args: { p_org: string }; Returns: string };
      remove_member: {
        Args: { p_org: string; p_user: string };
        Returns: undefined;
      };
      rename_organization: {
        Args: { p_name: string; p_org: string };
        Returns: undefined;
      };
      report_summary: {
        Args: { p_from: string; p_org: string; p_to: string };
        Returns: Json;
      };
      request_to_join: { Args: { p_code: string }; Returns: Json };
      safe_uuid: { Args: { value: string }; Returns: string };
      set_member_role: {
        Args: { p_org: string; p_role: string; p_user: string };
        Returns: undefined;
      };
      set_member_status: {
        Args: { p_org: string; p_status: string; p_user: string };
        Returns: undefined;
      };
      set_organization_currency: {
        Args: { p_currency: string; p_org: string };
        Returns: undefined;
      };
      shares_org_with: { Args: { p_user: string }; Returns: boolean };
      transfer_ownership: {
        Args: { p_org: string; p_user: string };
        Returns: undefined;
      };
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

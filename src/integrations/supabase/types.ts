export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null;
          company_name: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          phone: string | null;
          pic_name: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          company_name: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          phone?: string | null;
          pic_name?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          company_name?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          phone?: string | null;
          pic_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_settings: {
        Row: {
          address: string;
          bank_accounts: Json;
          company_name: string;
          default_city: string;
          email: string;
          id: number | null;
          invoice_template: "vicky" | "boy" | "toms";
          logo_path: string | null;
          owner_id: string;
          phone: string;
          signature_path: string | null;
          signer_name: string;
          signer_title: string;
          updated_at: string;
        };
        Insert: {
          address?: string;
          bank_accounts?: Json;
          company_name?: string;
          default_city?: string;
          email?: string;
          id?: number;
          invoice_template?: "vicky" | "boy" | "toms";
          logo_path?: string | null;
          owner_id?: string;
          phone?: string;
          signature_path?: string | null;
          signer_name?: string;
          signer_title?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          bank_accounts?: Json;
          company_name?: string;
          default_city?: string;
          email?: string;
          id?: number;
          invoice_template?: "vicky" | "boy" | "toms";
          logo_path?: string | null;
          owner_id?: string;
          phone?: string;
          signature_path?: string | null;
          signer_name?: string;
          signer_title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          car_type: string;
          created_at: string;
          days: number;
          id: string;
          invoice_id: string;
          line_total: number;
          plate_number: string | null;
          position: number;
          price_per_day: number;
          route: string | null;
          service_date: string | null;
          service_type: string | null;
          vehicle_id: string | null;
        };
        Insert: {
          car_type: string;
          created_at?: string;
          days: number;
          id?: string;
          invoice_id: string;
          line_total: number;
          plate_number?: string | null;
          position: number;
          price_per_day: number;
          route?: string | null;
          service_date?: string | null;
          service_type?: string | null;
          vehicle_id?: string | null;
        };
        Update: {
          car_type?: string;
          created_at?: string;
          days?: number;
          id?: string;
          invoice_id?: string;
          line_total?: number;
          plate_number?: string | null;
          position?: number;
          price_per_day?: number;
          route?: string | null;
          service_date?: string | null;
          service_type?: string | null;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_additional_charges: {
        Row: {
          amount: number;
          created_at: string;
          description: string;
          id: string;
          invoice_id: string;
          position: number;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description: string;
          id?: string;
          invoice_id: string;
          position: number;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string;
          id?: string;
          invoice_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_additional_charges_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          city: string;
          client_address: string | null;
          client_id: string | null;
          client_name: string;
          created_at: string;
          created_by: string | null;
          grand_total: number;
          id: string;
          invoice_date: string;
          invoice_number: string;
          notes: string | null;
          pic_name: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          city?: string;
          client_address?: string | null;
          client_id?: string | null;
          client_name: string;
          created_at?: string;
          created_by?: string | null;
          grand_total?: number;
          id?: string;
          invoice_date: string;
          invoice_number: string;
          notes?: string | null;
          pic_name?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          city?: string;
          client_address?: string | null;
          client_id?: string | null;
          client_name?: string;
          created_at?: string;
          created_by?: string | null;
          grand_total?: number;
          id?: string;
          invoice_date?: string;
          invoice_number?: string;
          notes?: string | null;
          pic_name?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rental_bookings: {
        Row: {
          booking_status: "Booking" | "Berjalan" | "Selesai" | "Dibatalkan" | "No Show";
          car_type: string;
          city: string;
          created_at: string;
          created_by: string | null;
          customer_name: string;
          daily_rate: number;
          deposit: number;
          driver_cost: number;
          end_date: string;
          end_time: string | null;
          id: string;
          notes: string | null;
          normal_rate: number | null;
          paid: number;
          payment_status: "Belum Bayar" | "DP" | "Lunas" | "Dibatalkan";
          plate_number: string;
          route: string | null;
          rental_mode: "Kalender" | "24jam";
          service: string;
          start_date: string;
          start_time: string | null;
          updated_at: string;
          vehicle_id: string | null;
          whatsapp: string | null;
        };
        Insert: {
          booking_status?: "Booking" | "Berjalan" | "Selesai" | "Dibatalkan" | "No Show";
          car_type: string;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          customer_name: string;
          daily_rate?: number;
          deposit?: number;
          driver_cost?: number;
          end_date: string;
          end_time?: string | null;
          id?: string;
          notes?: string | null;
          normal_rate?: number | null;
          paid?: number;
          payment_status?: "Belum Bayar" | "DP" | "Lunas" | "Dibatalkan";
          plate_number: string;
          route?: string | null;
          rental_mode?: "Kalender" | "24jam";
          service?: string;
          start_date: string;
          start_time?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          booking_status?: "Booking" | "Berjalan" | "Selesai" | "Dibatalkan" | "No Show";
          car_type?: string;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          daily_rate?: number;
          deposit?: number;
          driver_cost?: number;
          end_date?: string;
          end_time?: string | null;
          id?: string;
          notes?: string | null;
          normal_rate?: number | null;
          paid?: number;
          payment_status?: "Belum Bayar" | "DP" | "Lunas" | "Dibatalkan";
          plate_number?: string;
          route?: string | null;
          rental_mode?: "Kalender" | "24jam";
          service?: string;
          start_date?: string;
          start_time?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rental_bookings_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          brand: string | null;
          car_type: string;
          capacity: number | null;
          color: string | null;
          created_at: string;
          current_km: number;
          default_price: number | null;
          id: string;
          insurance_date: string | null;
          model: string | null;
          plate_number: string;
          status: "Tersedia" | "Disewa" | "Servis";
          stnk_date: string | null;
          tax_date: string | null;
          transmission: string;
          updated_at: string;
          year: number | null;
          notes: string | null;
        };
        Insert: {
          brand?: string | null;
          car_type: string;
          capacity?: number | null;
          color?: string | null;
          created_at?: string;
          current_km?: number;
          default_price?: number | null;
          id?: string;
          insurance_date?: string | null;
          model?: string | null;
          plate_number: string;
          status?: "Tersedia" | "Disewa" | "Servis";
          stnk_date?: string | null;
          tax_date?: string | null;
          transmission?: string;
          updated_at?: string;
          year?: number | null;
          notes?: string | null;
        };
        Update: {
          brand?: string | null;
          car_type?: string;
          capacity?: number | null;
          color?: string | null;
          created_at?: string;
          current_km?: number;
          default_price?: number | null;
          id?: string;
          insurance_date?: string | null;
          model?: string | null;
          plate_number?: string;
          status?: "Tersedia" | "Disewa" | "Servis";
          stnk_date?: string | null;
          tax_date?: string | null;
          transmission?: string;
          updated_at?: string;
          year?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      next_invoice_number: { Args: never; Returns: string };
      save_invoice: { Args: { p: Json }; Returns: string };
    };
    Enums: {
      app_role: "admin" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const;

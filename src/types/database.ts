export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      date_exceptions: {
        Row: {
          afwijkende_capaciteit: number | null
          created_at: string
          datum: string
          geblokkeerd: boolean
          geblokkeerde_tijdsloten: string[] | null
          gesloten: boolean
          id: string
          opmerking: string | null
          shift_template_id: string | null
          updated_at: string
        }
        Insert: {
          afwijkende_capaciteit?: number | null
          created_at?: string
          datum: string
          geblokkeerd?: boolean
          geblokkeerde_tijdsloten?: string[] | null
          gesloten?: boolean
          id?: string
          opmerking?: string | null
          shift_template_id?: string | null
          updated_at?: string
        }
        Update: {
          afwijkende_capaciteit?: number | null
          created_at?: string
          datum?: string
          geblokkeerd?: boolean
          geblokkeerde_tijdsloten?: string[] | null
          gesloten?: boolean
          id?: string
          opmerking?: string | null
          shift_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_exceptions_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          gelezen: boolean
          id: string
          reservation_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          gelezen?: boolean
          id?: string
          reservation_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          gelezen?: boolean
          id?: string
          reservation_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_logs: {
        Row: {
          actie: string
          created_at: string
          details: Json | null
          id: string
          reservation_id: string
        }
        Insert: {
          actie: string
          created_at?: string
          details?: Json | null
          id?: string
          reservation_id: string
        }
        Update: {
          actie?: string
          created_at?: string
          details?: Json | null
          id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          aantal_personen: number
          bron: string
          cancel_token: string
          created_at: string
          datum: string
          email: string
          id: string
          menu: boolean
          naam: string
          opmerking: string | null
          reminder_sent_at: string | null
          shift_template_id: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          telefoon: string | null
          tijdslot: string
          updated_at: string
          voornaam: string
        }
        Insert: {
          aantal_personen: number
          bron?: string
          cancel_token?: string
          created_at?: string
          datum: string
          email: string
          id?: string
          menu?: boolean
          naam: string
          opmerking?: string | null
          reminder_sent_at?: string | null
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          telefoon?: string | null
          tijdslot: string
          updated_at?: string
          voornaam: string
        }
        Update: {
          aantal_personen?: number
          bron?: string
          cancel_token?: string
          created_at?: string
          datum?: string
          email?: string
          id?: string
          menu?: boolean
          naam?: string
          opmerking?: string | null
          reminder_sent_at?: string | null
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          telefoon?: string | null
          tijdslot?: string
          updated_at?: string
          voornaam?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          boekingshorizon_dagen: number
          created_at: string
          herinnering_uren_vooraf: number
          herinneringen_actief: boolean
          id: number
          max_groepsgrootte: number
          menu_link: string | null
          min_voorboekingsuren: number
          notificatie_email: string
          restaurant_naam: string
          slot_minuten: number
          standaard_capaciteit: number
          updated_at: string
          widget_lettertype: string
          widget_primaire_kleur: string
        }
        Insert: {
          boekingshorizon_dagen?: number
          created_at?: string
          herinnering_uren_vooraf?: number
          herinneringen_actief?: boolean
          id?: number
          max_groepsgrootte?: number
          menu_link?: string | null
          min_voorboekingsuren?: number
          notificatie_email?: string
          restaurant_naam?: string
          slot_minuten?: number
          standaard_capaciteit?: number
          updated_at?: string
          widget_lettertype?: string
          widget_primaire_kleur?: string
        }
        Update: {
          boekingshorizon_dagen?: number
          created_at?: string
          herinnering_uren_vooraf?: number
          herinneringen_actief?: boolean
          id?: number
          max_groepsgrootte?: number
          menu_link?: string | null
          min_voorboekingsuren?: number
          notificatie_email?: string
          restaurant_naam?: string
          slot_minuten?: number
          standaard_capaciteit?: number
          updated_at?: string
          widget_lettertype?: string
          widget_primaire_kleur?: string
        }
        Relationships: []
      }
      shift_templates: {
        Row: {
          actief: boolean
          capaciteit_per_slot: number | null
          created_at: string
          eind_tijd: string
          id: string
          naam: string
          start_tijd: string
          updated_at: string
          weekdag: number
        }
        Insert: {
          actief?: boolean
          capaciteit_per_slot?: number | null
          created_at?: string
          eind_tijd: string
          id?: string
          naam: string
          start_tijd: string
          updated_at?: string
          weekdag: number
        }
        Update: {
          actief?: boolean
          capaciteit_per_slot?: number | null
          created_at?: string
          eind_tijd?: string
          id?: string
          naam?: string
          start_tijd?: string
          updated_at?: string
          weekdag?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_reservation: {
        Args: { p_token: string }
        Returns: {
          aantal_personen: number
          bron: string
          cancel_token: string
          created_at: string
          datum: string
          email: string
          id: string
          menu: boolean
          naam: string
          opmerking: string | null
          reminder_sent_at: string | null
          shift_template_id: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          telefoon: string | null
          tijdslot: string
          updated_at: string
          voornaam: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_reservation: {
        Args: {
          p_aantal_personen: number
          p_bron?: string
          p_capaciteit: number
          p_datum: string
          p_email: string
          p_menu: boolean
          p_naam: string
          p_opmerking: string
          p_shift_template_id: string
          p_telefoon: string
          p_tijdslot: string
          p_voornaam: string
        }
        Returns: {
          aantal_personen: number
          bron: string
          cancel_token: string
          created_at: string
          datum: string
          email: string
          id: string
          menu: boolean
          naam: string
          opmerking: string | null
          reminder_sent_at: string | null
          shift_template_id: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          telefoon: string | null
          tijdslot: string
          updated_at: string
          voornaam: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_bezetting: {
        Args: { p_tot: string; p_van: string }
        Returns: {
          aantal_bezet: number
          datum: string
          tijdslot: string
        }[]
      }
      get_public_settings: {
        Args: never
        Returns: {
          boekingshorizon_dagen: number
          max_groepsgrootte: number
          menu_link: string
          restaurant_naam: string
          slot_minuten: number
          widget_lettertype: string
          widget_primaire_kleur: string
        }[]
      }
      log_and_notify: {
        Args: {
          p_actie: string
          p_details: Json
          p_notification_type: string
          p_reservation_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      reservation_status: "bevestigd" | "aangekomen" | "no_show" | "geannuleerd"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      reservation_status: ["bevestigd", "aangekomen", "no_show", "geannuleerd"],
    },
  },
} as const

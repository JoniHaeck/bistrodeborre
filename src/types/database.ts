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
          restaurant_id: string
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
          restaurant_id: string
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
          restaurant_id?: string
          shift_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_exceptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_exceptions_restaurant_id_shift_template_id_fkey"
            columns: ["restaurant_id", "shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          restaurant_id: string
          rol: Database["public"]["Enums"]["lid_rol"]
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          rol?: Database["public"]["Enums"]["lid_rol"]
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          rol?: Database["public"]["Enums"]["lid_rol"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          restaurant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          gelezen?: boolean
          id?: string
          reservation_id?: string | null
          restaurant_id: string
          type: string
        }
        Update: {
          created_at?: string
          gelezen?: boolean
          id?: string
          reservation_id?: string | null
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_reservation_id_fkey"
            columns: ["restaurant_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["restaurant_id", "id"]
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
          restaurant_id: string
        }
        Insert: {
          actie: string
          created_at?: string
          details?: Json | null
          id?: string
          reservation_id: string
          restaurant_id: string
        }
        Update: {
          actie?: string
          created_at?: string
          details?: Json | null
          id?: string
          reservation_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_logs_restaurant_id_reservation_id_fkey"
            columns: ["restaurant_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["restaurant_id", "id"]
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
          duur_minuten: number | null
          email: string
          externe_id: string | null
          id: string
          menu: boolean
          naam: string
          opmerking: string | null
          reminder_sent_at: string | null
          restaurant_id: string
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
          duur_minuten?: number | null
          email: string
          externe_id?: string | null
          id?: string
          menu?: boolean
          naam: string
          opmerking?: string | null
          reminder_sent_at?: string | null
          restaurant_id: string
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
          duur_minuten?: number | null
          email?: string
          externe_id?: string | null
          id?: string
          menu?: boolean
          naam?: string
          opmerking?: string | null
          reminder_sent_at?: string | null
          restaurant_id?: string
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          telefoon?: string | null
          tijdslot?: string
          updated_at?: string
          voornaam?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_shift_template_id_fkey"
            columns: ["restaurant_id", "shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          email: string | null
          gemeente: string | null
          google_place_id: string | null
          id: string
          land: string
          lat: number | null
          lng: number | null
          naam: string
          postcode: string | null
          proef_tot: string | null
          slug: string
          status: string
          straat: string | null
          telefoon: string | null
          tijdzone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          gemeente?: string | null
          google_place_id?: string | null
          id?: string
          land?: string
          lat?: number | null
          lng?: number | null
          naam: string
          postcode?: string | null
          proef_tot?: string | null
          slug: string
          status?: string
          straat?: string | null
          telefoon?: string | null
          tijdzone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          gemeente?: string | null
          google_place_id?: string | null
          id?: string
          land?: string
          lat?: number | null
          lng?: number | null
          naam?: string
          postcode?: string | null
          proef_tot?: string | null
          slug?: string
          status?: string
          straat?: string | null
          telefoon?: string | null
          tijdzone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          boekingshorizon_dagen: number
          created_at: string
          herinnering_uren_vooraf: number
          herinneringen_actief: boolean
          logo_url: string | null
          max_groepsgrootte: number
          menu_link: string | null
          min_voorboekingsuren: number
          notificatie_email: string | null
          restaurant_id: string
          slot_minuten: number
          standaard_capaciteit: number
          standaard_duur_minuten: number
          updated_at: string
          widget_lettertype: string
          widget_primaire_kleur: string
        }
        Insert: {
          boekingshorizon_dagen?: number
          created_at?: string
          herinnering_uren_vooraf?: number
          herinneringen_actief?: boolean
          logo_url?: string | null
          max_groepsgrootte?: number
          menu_link?: string | null
          min_voorboekingsuren?: number
          notificatie_email?: string | null
          restaurant_id: string
          slot_minuten?: number
          standaard_capaciteit?: number
          standaard_duur_minuten?: number
          updated_at?: string
          widget_lettertype?: string
          widget_primaire_kleur?: string
        }
        Update: {
          boekingshorizon_dagen?: number
          created_at?: string
          herinnering_uren_vooraf?: number
          herinneringen_actief?: boolean
          logo_url?: string | null
          max_groepsgrootte?: number
          menu_link?: string | null
          min_voorboekingsuren?: number
          notificatie_email?: string | null
          restaurant_id?: string
          slot_minuten?: number
          standaard_capaciteit?: number
          standaard_duur_minuten?: number
          updated_at?: string
          widget_lettertype?: string
          widget_primaire_kleur?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          actief: boolean
          capaciteit_per_slot: number | null
          created_at: string
          eind_tijd: string
          id: string
          naam: string
          restaurant_id: string
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
          restaurant_id: string
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
          restaurant_id?: string
          start_tijd?: string
          updated_at?: string
          weekdag?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
          duur_minuten: number | null
          email: string
          externe_id: string | null
          id: string
          menu: boolean
          naam: string
          opmerking: string | null
          reminder_sent_at: string | null
          restaurant_id: string
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
          p_externe_id?: string
          p_menu: boolean
          p_naam: string
          p_opmerking: string
          p_restaurant_id: string
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
          duur_minuten: number | null
          email: string
          externe_id: string | null
          id: string
          menu: boolean
          naam: string
          opmerking: string | null
          reminder_sent_at: string | null
          restaurant_id: string
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
        Args: { p_restaurant_id: string; p_tot: string; p_van: string }
        Returns: {
          aantal_bezet: number
          datum: string
          tijdslot: string
        }[]
      }
      get_public_settings: {
        Args: { p_restaurant_id: string }
        Returns: {
          boekingshorizon_dagen: number
          logo_url: string
          max_groepsgrootte: number
          menu_link: string
          restaurant_naam: string
          slot_minuten: number
          widget_lettertype: string
          widget_primaire_kleur: string
        }[]
      }
      is_lid: { Args: { p_restaurant_id: string }; Returns: boolean }
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
      lid_rol: "eigenaar" | "beheerder"
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
      lid_rol: ["eigenaar", "beheerder"],
      reservation_status: ["bevestigd", "aangekomen", "no_show", "geannuleerd"],
    },
  },
} as const

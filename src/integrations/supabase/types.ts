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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      category_departments: {
        Row: {
          category_id: string
          department_id: string
          id: string
        }
        Insert: {
          category_id: string
          department_id: string
          id?: string
        }
        Update: {
          category_id?: string
          department_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_departments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_blog: {
        Row: {
          author: string
          created_at: string
          excerpt: string
          id: string
          period: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          created_at?: string
          excerpt?: string
          id?: string
          period?: string
          title?: string
          updated_at?: string
        }
        Update: {
          author?: string
          created_at?: string
          excerpt?: string
          id?: string
          period?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_index: {
        Row: {
          content: string
          fts: unknown
          id: string
          metadata: Json | null
          source_id: string
          source_table: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          fts?: unknown
          id?: string
          metadata?: Json | null
          source_id: string
          source_table: string
          title?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          fts?: unknown
          id?: string
          metadata?: Json | null
          source_id?: string
          source_table?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          created_at: string
          created_by: string
          file_size: number
          folder_id: string
          id: string
          mime_type: string
          name: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_size?: number
          folder_id: string
          id?: string
          mime_type?: string
          name: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_size?: number
          folder_id?: string
          id?: string
          mime_type?: string
          name?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          access_roles: string[] | null
          created_at: string
          created_by: string
          icon: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          write_roles: string[] | null
        }
        Insert: {
          access_roles?: string[] | null
          created_at?: string
          created_by: string
          icon?: string
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          write_roles?: string[] | null
        }
        Update: {
          access_roles?: string[] | null
          created_at?: string
          created_by?: string
          icon?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          write_roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          role_equivalent: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          role_equivalent?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          role_equivalent?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      it_faq: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      kb_articles: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string
          excerpt: string
          id: string
          is_published: boolean
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      kb_videos: {
        Row: {
          author_id: string
          category_id: string | null
          created_at: string
          description: string
          duration_seconds: number | null
          id: string
          is_published: boolean
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
          views: number
        }
        Insert: {
          author_id: string
          category_id?: string | null
          created_at?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
          views?: number
        }
        Update: {
          author_id?: string
          category_id?: string | null
          created_at?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      module_activity_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          module_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          module_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_activity_log_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          created_by: string | null
          grantee_id: string
          grantee_type: string
          id: string
          is_owner: boolean | null
          module_id: string
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          created_by?: string | null
          grantee_id: string
          grantee_type?: string
          id?: string
          is_owner?: boolean | null
          module_id: string
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          created_by?: string | null
          grantee_id?: string
          grantee_type?: string
          id?: string
          is_owner?: boolean | null
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_role_access: {
        Row: {
          has_access: boolean
          id: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          has_access?: boolean
          id?: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          has_access?: boolean
          id?: string
          module_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "module_role_access_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          route: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          route: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          route?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_id: string
          order_type_id: string | null
          quantity: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_id: string
          order_type_id?: string | null
          quantity?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_id?: string
          order_type_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
        ]
      }
      order_systems: {
        Row: {
          created_at: string
          id: string
          order_id: string
          system_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          system_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_systems_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      order_type_departments: {
        Row: {
          department_id: string
          id: string
          order_type_id: string
        }
        Insert: {
          department_id: string
          id?: string
          order_type_id: string
        }
        Update: {
          department_id?: string
          id?: string
          order_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_type_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_type_departments_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
        ]
      }
      order_types: {
        Row: {
          category: Database["public"]["Enums"]["order_category"]
          category_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["order_category"]
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["order_category"]
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          category: Database["public"]["Enums"]["order_category"]
          category_id: string | null
          created_at: string
          delivery_comment: string | null
          description: string | null
          id: string
          order_reason: string | null
          order_type_id: string | null
          recipient_department: string | null
          recipient_name: string | null
          recipient_start_date: string | null
          recipient_type: string | null
          rejection_reason: string | null
          requester_id: string
          status: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          category?: Database["public"]["Enums"]["order_category"]
          category_id?: string | null
          created_at?: string
          delivery_comment?: string | null
          description?: string | null
          id?: string
          order_reason?: string | null
          order_type_id?: string | null
          recipient_department?: string | null
          recipient_name?: string | null
          recipient_start_date?: string | null
          recipient_type?: string | null
          rejection_reason?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          category?: Database["public"]["Enums"]["order_category"]
          category_id?: string | null
          created_at?: string
          delivery_comment?: string | null
          description?: string | null
          id?: string
          order_reason?: string | null
          order_type_id?: string | null
          recipient_department?: string | null
          recipient_name?: string | null
          recipient_start_date?: string | null
          recipient_type?: string | null
          rejection_reason?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chart_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      planner_activity_log: {
        Row: {
          action: string
          board_id: string
          created_at: string
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          board_id: string
          created_at?: string
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          board_id?: string
          created_at?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_activity_log_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "planner_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_boards: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      planner_card_attachments: {
        Row: {
          card_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          card_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_card_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "planner_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_card_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          content?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "planner_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_cards: {
        Row: {
          assignee_id: string | null
          board_id: string
          column_id: string
          cover_color: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_done: boolean
          id: string
          labels: string[] | null
          priority: string
          reporter_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          board_id: string
          column_id: string
          cover_color?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_done?: boolean
          id?: string
          labels?: string[] | null
          priority?: string
          reporter_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          board_id?: string
          column_id?: string
          cover_color?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_done?: boolean
          id?: string
          labels?: string[] | null
          priority?: string
          reporter_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "planner_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "planner_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_checklist_items: {
        Row: {
          checked: boolean
          checklist_id: string
          created_at: string
          id: string
          sort_order: number
          text: string
        }
        Insert: {
          checked?: boolean
          checklist_id: string
          created_at?: string
          id?: string
          sort_order?: number
          text?: string
        }
        Update: {
          checked?: boolean
          checklist_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "planner_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_checklists: {
        Row: {
          card_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "planner_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_columns: {
        Row: {
          board_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          wip_limit: number | null
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          wip_limit?: number | null
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planner_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "planner_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_staff: boolean | null
          manager_id: string | null
          phone: string | null
          sort_order: number | null
          theme_preference: string | null
          title_override: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_staff?: boolean | null
          manager_id?: string | null
          phone?: string | null
          sort_order?: number | null
          theme_preference?: string | null
          title_override?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_staff?: boolean | null
          manager_id?: string | null
          phone?: string | null
          sort_order?: number | null
          theme_preference?: string | null
          title_override?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recognitions: {
        Row: {
          created_at: string
          from_user_id: string
          icon: string
          id: string
          message: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          icon?: string
          id?: string
          message: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          icon?: string
          id?: string
          message?: string
          to_user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      systems: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      tools: {
        Row: {
          created_at: string
          description: string
          emoji: string
          id: string
          is_active: boolean
          is_starred: boolean
          name: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean
          is_starred?: boolean
          name: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean
          is_starred?: boolean
          name?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          _message?: string
          _reference_id?: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_all_user_roles: {
        Args: never
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_manager_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_subordinate_user_ids: {
        Args: { _manager_profile_id: string }
        Returns: {
          user_id: string
        }[]
      }
      has_folder_access: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      has_folder_write_access: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      has_module_permission: {
        Args: { _module_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_module_slug_permission: {
        Args: { _permission: string; _slug: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      search_content: {
        Args: { match_limit?: number; query_text: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          relevance: number
          source_id: string
          source_table: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "employee" | "manager" | "admin" | "staff" | "it"
      order_category: "computer" | "phone" | "peripheral" | "other"
      order_status: "pending" | "approved" | "rejected" | "delivered"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["employee", "manager", "admin", "staff", "it"],
      order_category: ["computer", "phone", "peripheral", "other"],
      order_status: ["pending", "approved", "rejected", "delivered"],
    },
  },
} as const

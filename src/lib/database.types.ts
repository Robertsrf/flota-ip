// Generado por scripts/gen-types.mjs desde supabase/migrations. No editar a mano.
// Regenerar: npm run gen:types (local) o npm run gen:types:remote (proyecto Supabase).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      auditoria: {
        Row: {
          id: number
          tabla: string
          registro_id: string
          accion: string
          antes: Json | null
          despues: Json | null
          motivo: string | null
          usuario_id: string | null
          fecha: string
        }
        Insert: {
          id?: never
          tabla: string
          registro_id: string
          accion: string
          antes?: Json | null
          despues?: Json | null
          motivo?: string | null
          usuario_id?: string | null
          fecha?: string
        }
        Update: {
          id?: never
          tabla?: string
          registro_id?: string
          accion?: string
          antes?: Json | null
          despues?: Json | null
          motivo?: string | null
          usuario_id?: string | null
          fecha?: string
        }
        Relationships: []
      }
      categorias_mantenimiento: {
        Row: {
          id: string
          nombre: string
          icono: string | null
          activo: boolean
          orden: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          icono?: string | null
          activo?: boolean
          orden?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          icono?: string | null
          activo?: boolean
          orden?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          id: boolean
          tolerancia_heredado_km: number
          umbral_km_sin_ruta: number
          umbral_ruta_abierta_h: number
          umbral_consumo_anomalo_pct: number
          min_viajes_promedio: number
          umbral_divergencia_pct: number
          viaje_max_km: number
          viaje_max_h: number
          ventana_correccion_min: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          tolerancia_heredado_km?: number
          umbral_km_sin_ruta?: number
          umbral_ruta_abierta_h?: number
          umbral_consumo_anomalo_pct?: number
          min_viajes_promedio?: number
          umbral_divergencia_pct?: number
          viaje_max_km?: number
          viaje_max_h?: number
          ventana_correccion_min?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          tolerancia_heredado_km?: number
          umbral_km_sin_ruta?: number
          umbral_ruta_abierta_h?: number
          umbral_consumo_anomalo_pct?: number
          min_viajes_promedio?: number
          umbral_divergencia_pct?: number
          viaje_max_km?: number
          viaje_max_h?: number
          ventana_correccion_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      mantenimientos: {
        Row: {
          id: string
          folio: number
          unidad_id: string
          categoria_id: string
          fecha: string
          lectura_medidor: number | null
          descripcion: string | null
          proveedor: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          bs_por_usd: number | null
          monto_usd: number | null
          monto_bs: number | null
          factura_path: string | null
          estado_aprobacion: Database["public"]["Enums"]["estado_aprobacion"]
          revisado_por: string | null
          revisado_at: string | null
          rechazo_motivo: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          anulado: boolean
          anulado_motivo: string | null
        }
        Insert: {
          id?: string
          folio?: never
          unidad_id: string
          categoria_id: string
          fecha?: string
          lectura_medidor?: number | null
          descripcion?: string | null
          proveedor?: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          bs_por_usd?: number | null
          monto_usd?: never
          monto_bs?: never
          factura_path?: string | null
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion"]
          revisado_por?: string | null
          revisado_at?: string | null
          rechazo_motivo?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          anulado?: boolean
          anulado_motivo?: string | null
        }
        Update: {
          id?: string
          folio?: never
          unidad_id?: string
          categoria_id?: string
          fecha?: string
          lectura_medidor?: number | null
          descripcion?: string | null
          proveedor?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          bs_por_usd?: number | null
          monto_usd?: never
          monto_bs?: never
          factura_path?: string | null
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion"]
          revisado_por?: string | null
          revisado_at?: string | null
          rechazo_motivo?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          anulado?: boolean
          anulado_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mantenimientos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_mantenimiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          id: string
          nombre: string
          usuario: string | null
          correo: string | null
          telefono: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nombre: string
          usuario?: string | null
          correo?: string | null
          telefono?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          usuario?: string | null
          correo?: string | null
          telefono?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      precios_combustible: {
        Row: {
          id: string
          etiqueta: string
          precio_usd_litro: number
          activo: boolean
          orden: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          etiqueta: string
          precio_usd_litro: number
          activo?: boolean
          orden?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          etiqueta?: string
          precio_usd_litro?: number
          activo?: boolean
          orden?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      repostajes: {
        Row: {
          id: string
          folio: number
          unidad_id: string
          viaje_id: string | null
          chofer_id: string | null
          fecha: string
          lectura_medidor: number | null
          litros: number
          precio_id: string | null
          precio_usd_litro: number
          monto_usd: number | null
          tanque_lleno: boolean
          es_cierre_viaje: boolean
          carga_previa_omitida: boolean
          estacion: string | null
          recibo_path: string | null
          notas: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          anulado: boolean
          anulado_motivo: string | null
        }
        Insert: {
          id: string
          folio?: never
          unidad_id: string
          viaje_id?: string | null
          chofer_id?: string | null
          fecha: string
          lectura_medidor?: number | null
          litros: number
          precio_id?: string | null
          precio_usd_litro: number
          monto_usd?: never
          tanque_lleno?: boolean
          es_cierre_viaje?: boolean
          carga_previa_omitida?: boolean
          estacion?: string | null
          recibo_path?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          anulado?: boolean
          anulado_motivo?: string | null
        }
        Update: {
          id?: string
          folio?: never
          unidad_id?: string
          viaje_id?: string | null
          chofer_id?: string | null
          fecha?: string
          lectura_medidor?: number | null
          litros?: number
          precio_id?: string | null
          precio_usd_litro?: number
          monto_usd?: never
          tanque_lleno?: boolean
          es_cierre_viaje?: boolean
          carga_previa_omitida?: boolean
          estacion?: string | null
          recibo_path?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          anulado?: boolean
          anulado_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repostajes_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repostajes_precio_id_fkey"
            columns: ["precio_id"]
            isOneToOne: false
            referencedRelation: "precios_combustible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repostajes_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repostajes_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      tasas_bcv: {
        Row: {
          fecha: string
          bs_por_usd: number
          fuente: string
          manual: boolean
          capturada_at: string
          created_by: string | null
        }
        Insert: {
          fecha: string
          bs_por_usd: number
          fuente?: string
          manual?: boolean
          capturada_at?: string
          created_by?: string | null
        }
        Update: {
          fecha?: string
          bs_por_usd?: number
          fuente?: string
          manual?: boolean
          capturada_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      ubicaciones: {
        Row: {
          id: string
          nombre: string
          estado_ve: string | null
          municipio: string | null
          tipo: string
          activo: boolean
          es_sistema: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          nombre: string
          estado_ve?: string | null
          municipio?: string | null
          tipo?: string
          activo?: boolean
          es_sistema?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          estado_ve?: string | null
          municipio?: string | null
          tipo?: string
          activo?: boolean
          es_sistema?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      unidades: {
        Row: {
          id: string
          tipo: Database["public"]["Enums"]["tipo_unidad"]
          placa: string | null
          alias: string | null
          marca: string | null
          modelo: string | null
          anio: number | null
          combustible: Database["public"]["Enums"]["tipo_combustible"]
          medidor: Database["public"]["Enums"]["tipo_medidor"]
          capacidad_tanque_l: number
          lectura_inicial: number | null
          combustible_inicial_l: number
          fecha_alta: string
          foto_path: string | null
          estado: Database["public"]["Enums"]["estado_unidad"]
          chofer_habitual_id: string | null
          rendimiento_min: number
          rendimiento_max: number
          notas: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_unidad"]
          placa?: string | null
          alias?: string | null
          marca?: string | null
          modelo?: string | null
          anio?: number | null
          combustible?: Database["public"]["Enums"]["tipo_combustible"]
          medidor?: Database["public"]["Enums"]["tipo_medidor"]
          capacidad_tanque_l: number
          lectura_inicial?: number | null
          combustible_inicial_l?: number
          fecha_alta?: string
          foto_path?: string | null
          estado?: Database["public"]["Enums"]["estado_unidad"]
          chofer_habitual_id?: string | null
          rendimiento_min?: number
          rendimiento_max?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_unidad"]
          placa?: string | null
          alias?: string | null
          marca?: string | null
          modelo?: string | null
          anio?: number | null
          combustible?: Database["public"]["Enums"]["tipo_combustible"]
          medidor?: Database["public"]["Enums"]["tipo_medidor"]
          capacidad_tanque_l?: number
          lectura_inicial?: number | null
          combustible_inicial_l?: number
          fecha_alta?: string
          foto_path?: string | null
          estado?: Database["public"]["Enums"]["estado_unidad"]
          chofer_habitual_id?: string | null
          rendimiento_min?: number
          rendimiento_max?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_chofer_habitual_id_fkey"
            columns: ["chofer_habitual_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viaje_paradas: {
        Row: {
          viaje_id: string
          orden: number
          ubicacion_id: string
        }
        Insert: {
          viaje_id: string
          orden: number
          ubicacion_id: string
        }
        Update: {
          viaje_id?: string
          orden?: number
          ubicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaje_paradas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_paradas_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      viajes: {
        Row: {
          id: string
          folio: number
          unidad_id: string
          chofer_id: string
          origen_id: string | null
          destino_id: string
          salida_at: string
          km_salida: number
          litros_salida: number
          fuente_nivel_salida: string
          llegada_at: string | null
          km_llegada: number | null
          litros_llegada_aguja: number | null
          estado: Database["public"]["Enums"]["estado_viaje"]
          km_recorridos: number | null
          litros_consumidos: number | null
          rendimiento_kml: number | null
          litros_100km: number | null
          precio_promedio_usd: number | null
          costo_combustible_usd: number | null
          costo_km_usd: number | null
          calidad: Database["public"]["Enums"]["calidad_calculo"] | null
          revisar: boolean
          revisar_motivos: string[]
          foto_odometro_salida: string | null
          foto_odometro_llegada: string | null
          notas: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          anulado: boolean | null
          anulado_motivo: string | null
        }
        Insert: {
          id: string
          folio?: never
          unidad_id: string
          chofer_id: string
          origen_id?: string | null
          destino_id: string
          salida_at: string
          km_salida: number
          litros_salida: number
          fuente_nivel_salida: string
          llegada_at?: string | null
          km_llegada?: number | null
          litros_llegada_aguja?: number | null
          estado?: Database["public"]["Enums"]["estado_viaje"]
          km_recorridos?: number | null
          litros_consumidos?: number | null
          rendimiento_kml?: number | null
          litros_100km?: number | null
          precio_promedio_usd?: number | null
          costo_combustible_usd?: number | null
          costo_km_usd?: number | null
          calidad?: Database["public"]["Enums"]["calidad_calculo"] | null
          revisar?: boolean
          revisar_motivos?: string[]
          foto_odometro_salida?: string | null
          foto_odometro_llegada?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          anulado?: never
          anulado_motivo?: string | null
        }
        Update: {
          id?: string
          folio?: never
          unidad_id?: string
          chofer_id?: string
          origen_id?: string | null
          destino_id?: string
          salida_at?: string
          km_salida?: number
          litros_salida?: number
          fuente_nivel_salida?: string
          llegada_at?: string | null
          km_llegada?: number | null
          litros_llegada_aguja?: number | null
          estado?: Database["public"]["Enums"]["estado_viaje"]
          km_recorridos?: number | null
          litros_consumidos?: number | null
          rendimiento_kml?: number | null
          litros_100km?: number | null
          precio_promedio_usd?: number | null
          costo_combustible_usd?: number | null
          costo_km_usd?: number | null
          calidad?: Database["public"]["Enums"]["calidad_calculo"] | null
          revisar?: boolean
          revisar_motivos?: string[]
          foto_odometro_salida?: string | null
          foto_odometro_llegada?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          anulado?: never
          anulado_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viajes_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_alertas: {
        Row: {
          id: string | null
          tipo: string | null
          severidad: string | null
          unidad_id: string | null
          viaje_id: string | null
          registro_id: string | null
          fecha: string | null
          mensaje: string | null
        }
        Relationships: []
      }
      v_auditoria: {
        Row: {
          id: number | null
          tabla: string | null
          registro_id: string | null
          accion: string | null
          antes: Json | null
          despues: Json | null
          motivo: string | null
          usuario_id: string | null
          fecha: string | null
          usuario_nombre: string | null
        }
        Relationships: []
      }
      v_ciclos_combustible: {
        Row: {
          unidad_id: string | null
          ciclo: number | null
          lectura_inicio: number | null
          lectura_fin: number | null
          fecha_inicio: string | null
          fecha_fin: string | null
          distancia: number | null
          litros: number | null
          cargas: number | null
          rendimiento: number | null
          litros_100: number | null
          mes: string | null
          invalido: boolean | null
        }
        Relationships: []
      }
      v_kpi_flota_mes: {
        Row: {
          mes: string | null
          viajes: number | null
          km_total: number | null
          km: number | null
          litros: number | null
          costo_viajes: number | null
          rendimiento: number | null
          litros_100km: number | null
          costo_km_comb: number | null
          gasto_comb: number | null
          gasto_comb_camiones: number | null
          gasto_comb_plantas: number | null
          litros_plantas: number | null
          gasto_mant: number | null
          gasto_total: number | null
          costo_km_total: number | null
        }
        Relationships: []
      }
      v_kpi_unidad_mes: {
        Row: {
          unidad_id: string | null
          tipo: Database["public"]["Enums"]["tipo_unidad"] | null
          unidad_nombre: string | null
          mes: string | null
          viajes: number | null
          km_total: number | null
          km: number | null
          litros: number | null
          costo_viajes: number | null
          rendimiento: number | null
          litros_100km: number | null
          costo_km_comb: number | null
          km_exacto: number | null
          litros_exacto: number | null
          costo_exacto: number | null
          cargas: number | null
          litros_cargados: number | null
          gasto_comb: number | null
          gasto_mant: number | null
          gasto_total: number | null
          costo_km_total: number | null
        }
        Relationships: []
      }
      v_mant_categoria_mes: {
        Row: {
          unidad_id: string | null
          tipo: Database["public"]["Enums"]["tipo_unidad"] | null
          categoria_id: string | null
          categoria: string | null
          mes: string | null
          gastos: number | null
          monto_usd: number | null
        }
        Relationships: []
      }
      v_mantenimientos: {
        Row: {
          id: string | null
          folio: number | null
          unidad_id: string | null
          categoria_id: string | null
          fecha: string | null
          lectura_medidor: number | null
          descripcion: string | null
          proveedor: string | null
          moneda: Database["public"]["Enums"]["moneda"] | null
          monto: number | null
          bs_por_usd: number | null
          monto_usd: number | null
          monto_bs: number | null
          factura_path: string | null
          estado_aprobacion: Database["public"]["Enums"]["estado_aprobacion"] | null
          revisado_por: string | null
          revisado_at: string | null
          rechazo_motivo: string | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          anulado: boolean | null
          anulado_motivo: string | null
          folio_txt: string | null
          unidad_tipo: Database["public"]["Enums"]["tipo_unidad"] | null
          unidad_nombre: string | null
          categoria_nombre: string | null
          registrado_por_nombre: string | null
          registrado_por_rol: Database["public"]["Enums"]["rol_usuario"] | null
          revisado_por_nombre: string | null
        }
        Relationships: []
      }
      v_repostajes: {
        Row: {
          id: string | null
          folio: number | null
          unidad_id: string | null
          viaje_id: string | null
          chofer_id: string | null
          fecha: string | null
          lectura_medidor: number | null
          litros: number | null
          precio_id: string | null
          precio_usd_litro: number | null
          monto_usd: number | null
          tanque_lleno: boolean | null
          es_cierre_viaje: boolean | null
          carga_previa_omitida: boolean | null
          estacion: string | null
          recibo_path: string | null
          notas: string | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          anulado: boolean | null
          anulado_motivo: string | null
          folio_txt: string | null
          unidad_tipo: Database["public"]["Enums"]["tipo_unidad"] | null
          unidad_nombre: string | null
          capacidad_tanque_l: number | null
          medidor: Database["public"]["Enums"]["tipo_medidor"] | null
          chofer_nombre: string | null
          viaje_folio_txt: string | null
          precio_etiqueta: string | null
          fecha_local: string | null
          fecha_gasto: string | null
          registrado_por_nombre: string | null
        }
        Relationships: []
      }
      v_unidades: {
        Row: {
          id: string | null
          tipo: Database["public"]["Enums"]["tipo_unidad"] | null
          placa: string | null
          alias: string | null
          marca: string | null
          modelo: string | null
          anio: number | null
          combustible: Database["public"]["Enums"]["tipo_combustible"] | null
          medidor: Database["public"]["Enums"]["tipo_medidor"] | null
          capacidad_tanque_l: number | null
          lectura_inicial: number | null
          combustible_inicial_l: number | null
          fecha_alta: string | null
          foto_path: string | null
          estado: Database["public"]["Enums"]["estado_unidad"] | null
          chofer_habitual_id: string | null
          rendimiento_min: number | null
          rendimiento_max: number | null
          notas: string | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          nombre: string | null
          chofer_habitual_nombre: string | null
          lectura_actual: number | null
          viaje_abierto_id: string | null
          viaje_abierto_folio: number | null
          viaje_abierto_salida_at: string | null
          viaje_abierto_km_salida: number | null
          viaje_abierto_chofer: string | null
          viaje_abierto_destino: string | null
          nivel_estimado_l: number | null
          nivel_estimado_fuente: string | null
          nivel_base_fecha: string | null
        }
        Relationships: []
      }
      v_viajes: {
        Row: {
          id: string | null
          folio: number | null
          unidad_id: string | null
          chofer_id: string | null
          origen_id: string | null
          destino_id: string | null
          salida_at: string | null
          km_salida: number | null
          litros_salida: number | null
          fuente_nivel_salida: string | null
          llegada_at: string | null
          km_llegada: number | null
          litros_llegada_aguja: number | null
          estado: Database["public"]["Enums"]["estado_viaje"] | null
          km_recorridos: number | null
          litros_consumidos: number | null
          rendimiento_kml: number | null
          litros_100km: number | null
          precio_promedio_usd: number | null
          costo_combustible_usd: number | null
          costo_km_usd: number | null
          calidad: Database["public"]["Enums"]["calidad_calculo"] | null
          revisar: boolean | null
          revisar_motivos: string[] | null
          foto_odometro_salida: string | null
          foto_odometro_llegada: string | null
          notas: string | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          anulado: boolean | null
          anulado_motivo: string | null
          folio_txt: string | null
          unidad_tipo: Database["public"]["Enums"]["tipo_unidad"] | null
          placa: string | null
          alias: string | null
          unidad_nombre: string | null
          capacidad_tanque_l: number | null
          combustible: Database["public"]["Enums"]["tipo_combustible"] | null
          chofer_nombre: string | null
          origen_nombre: string | null
          destino_nombre: string | null
          paradas_ids: string[] | null
          paradas_nombres: string[] | null
          ruta: string | null
          fecha_salida: string | null
          fecha_llegada: string | null
          mes: string | null
          cargas: number | null
          litros_cargados: number | null
          monto_cargado: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      anular_registro: {
        Args: {
          p_tabla: string
          p_id: string
          p_motivo: string
        }
        Returns: undefined
      }
      contexto_cabina: {
        Args: never
        Returns: Json
      }
      corregir_registro: {
        Args: {
          p_tabla: string
          p_id: string
          p_cambios: Json
          p_motivo: string
        }
        Returns: Json
      }
      costo_por_destino: {
        Args: {
          p_desde: string
          p_hasta: string
          p_unidad?: string
          p_chofer?: string
          p_solo_exactos?: boolean
        }
        Returns: {
            destino_id: string | null
            destino: string | null
            viajes: number | null
            km_prom: number | null
            litros_prom: number | null
            costo_prom: number | null
            rendimiento: number | null
            costo_total: number | null
            costo_km: number | null
          }[]
      }
      costo_por_ruta: {
        Args: {
          p_desde: string
          p_hasta: string
          p_unidad?: string
          p_chofer?: string
          p_solo_exactos?: boolean
        }
        Returns: {
            ruta: string | null
            paradas: number | null
            viajes: number | null
            km_prom: number | null
            litros_prom: number | null
            costo_prom: number | null
            rendimiento: number | null
            costo_total: number | null
          }[]
      }
      eliminar_ubicacion: {
        Args: {
          p_id: string
        }
        Returns: string
      }
      es_oficina: {
        Args: never
        Returns: boolean
      }
      es_superusuario: {
        Args: never
        Returns: boolean
      }
      fecha_txt: {
        Args: {
          p_ts: string
        }
        Returns: string
      }
      finalizar_viaje: {
        Args: {
          p_viaje_id: string
          p_llegada_at: string
          p_km_llegada: number
          p_reposto: boolean
          p_repostaje_id?: string
          p_litros?: number
          p_precio_id?: string
          p_tanque_lleno?: boolean
          p_litros_aguja?: number
          p_recibo?: string
          p_foto?: string
          p_notas?: string
          p_estacion?: string
        }
        Returns: Database["public"]["Tables"]["viajes"]["Row"]
      }
      fmt_num: {
        Args: {
          n: number
          decimales?: number
        }
        Returns: string
      }
      folio_txt: {
        Args: {
          p_prefijo: string
          p_folio: number
        }
        Returns: string
      }
      hoy_caracas: {
        Args: never
        Returns: string
      }
      iniciar_viaje: {
        Args: {
          p_id: string
          p_unidad_id: string
          p_paradas: string[]
          p_salida_at: string
          p_km_salida: number
          p_litros_salida: number
          p_fuente_nivel: string
          p_origen_id?: string
          p_foto?: string
          p_notas?: string
          p_chofer_id?: string
          p_motivo?: string
        }
        Returns: Database["public"]["Tables"]["viajes"]["Row"]
      }
      kpis_periodo: {
        Args: {
          p_desde: string
          p_hasta: string
          p_unidad?: string
          p_chofer?: string
          p_destino?: string
          p_solo_exactos?: boolean
        }
        Returns: Json
      }
      lectura_actual: {
        Args: {
          p_unidad: string
        }
        Returns: number
      }
      marcar_revisado: {
        Args: {
          p_viaje_id: string
          p_nota: string
        }
        Returns: Database["public"]["Tables"]["viajes"]["Row"]
      }
      nivel_estimado: {
        Args: {
          p_unidad: string
        }
        Returns: {
            litros: number | null
            fuente: string | null
            base_litros: number | null
            base_lectura: number | null
            base_fecha: string | null
          }[]
      }
      nombre_unidad: {
        Args: {
          p_unidad: string
        }
        Returns: string
      }
      registrar_mantenimiento: {
        Args: {
          p_id: string
          p_unidad_id: string
          p_categoria_id: string
          p_fecha: string
          p_moneda: Database["public"]["Enums"]["moneda"]
          p_monto: number
          p_bs_por_usd?: number
          p_lectura?: number
          p_descripcion?: string
          p_proveedor?: string
          p_factura?: string
        }
        Returns: Database["public"]["Tables"]["mantenimientos"]["Row"]
      }
      registrar_repostaje: {
        Args: {
          p_id: string
          p_unidad_id: string
          p_fecha: string
          p_lectura: number
          p_litros: number
          p_precio_id: string
          p_tanque_lleno?: boolean
          p_estacion?: string
          p_recibo?: string
          p_notas?: string
          p_carga_previa_omitida?: boolean
          p_motivo?: string
        }
        Returns: Database["public"]["Tables"]["repostajes"]["Row"]
      }
      restaurar_registro: {
        Args: {
          p_tabla: string
          p_id: string
          p_motivo: string
        }
        Returns: undefined
      }
      resumen_unidades: {
        Args: {
          p_desde: string
          p_hasta: string
          p_unidad?: string
          p_chofer?: string
          p_destino?: string
          p_solo_exactos?: boolean
        }
        Returns: {
            unidad_id: string | null
            tipo: Database["public"]["Enums"]["tipo_unidad"] | null
            nombre: string | null
            placa: string | null
            alias: string | null
            estado: Database["public"]["Enums"]["estado_unidad"] | null
            viajes: number | null
            km_total: number | null
            km: number | null
            litros: number | null
            costo_viajes: number | null
            rendimiento: number | null
            litros_100km: number | null
            costo_km_comb: number | null
            cargas: number | null
            litros_cargados: number | null
            gasto_comb: number | null
            gasto_mant: number | null
            gasto_total: number | null
            costo_km_total: number | null
            viajes_incompletos: number | null
          }[]
      }
      revisar_gasto: {
        Args: {
          p_id: string
          p_aprobar: boolean
          p_motivo?: string
        }
        Returns: Database["public"]["Tables"]["mantenimientos"]["Row"]
      }
      rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      sugerir_nivel_salida: {
        Args: {
          p_unidad: string
          p_km: number
        }
        Returns: {
            fuente: string | null
            litros: number | null
            lectura: number | null
            descripcion: string | null
          }[]
      }
      tasa_para_fecha: {
        Args: {
          p_fecha: string
        }
        Returns: {
            fecha: string | null
            bs_por_usd: number | null
            manual: boolean | null
            fuente: string | null
          }[]
      }
      unidad_permitida_chofer: {
        Args: {
          p_unidad: string
        }
        Returns: boolean
      }
    }
    Enums: {
      calidad_calculo: "exacto" | "estimado" | "incompleto"
      estado_aprobacion: "pendiente" | "aprobado" | "rechazado"
      estado_unidad: "disponible" | "en_ruta" | "taller" | "inactivo"
      estado_viaje: "en_curso" | "cerrado" | "anulado"
      moneda: "USD" | "VES"
      rol_usuario: "superusuario" | "flota" | "chofer" | "consulta"
      tipo_combustible: "gasolina" | "diesel"
      tipo_medidor: "km" | "horas" | "ninguno"
      tipo_unidad: "camion" | "planta"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"]> =
  T extends keyof PublicSchema["Tables"] ? PublicSchema["Tables"][T]["Row"]
  : T extends keyof PublicSchema["Views"] ? PublicSchema["Views"][T]["Row"] : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      calidad_calculo: ["exacto", "estimado", "incompleto"],
      estado_aprobacion: ["pendiente", "aprobado", "rechazado"],
      estado_unidad: ["disponible", "en_ruta", "taller", "inactivo"],
      estado_viaje: ["en_curso", "cerrado", "anulado"],
      moneda: ["USD", "VES"],
      rol_usuario: ["superusuario", "flota", "chofer", "consulta"],
      tipo_combustible: ["gasolina", "diesel"],
      tipo_medidor: ["km", "horas", "ninguno"],
      tipo_unidad: ["camion", "planta"],
    },
  },
} as const

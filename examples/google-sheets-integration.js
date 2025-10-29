// Ejemplo de integración con Google Sheets API para Control Store
// Este archivo muestra cómo usar los endpoints desde el frontend

class GoogleSheetsIntegration {
  constructor(backendUrl, idToken) {
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.idToken = idToken;
  }

  // Headers comunes para todas las requests
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.idToken}`,
      'Content-Type': 'application/json'
    };
  }

  // 1. Crear hoja de productos para una tienda
  async createProductSheet(storeId, authCode) {
    try {
      const response = await fetch(`${this.backendUrl}/api/stores/${storeId}/sheets/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ authCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creating sheet');
      }

      return data;
    } catch (error) {
      console.error('Error creating product sheet:', error);
      throw error;
    }
  }

  // 2. Obtener productos de una tienda
  async getProducts(storeId, forceRefresh = false) {
    try {
      const url = `${this.backendUrl}/api/stores/${storeId}/products${forceRefresh ? '?forceRefresh=true' : ''}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error getting products');
      }

      return data;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  // 3. Sincronizar productos desde la hoja hacia Firestore
  async syncProducts(storeId) {
    try {
      const response = await fetch(`${this.backendUrl}/api/stores/${storeId}/sheets/sync`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error syncing products');
      }

      return data;
    } catch (error) {
      console.error('Error syncing products:', error);
      throw error;
    }
  }

  // 4. Crear backup de la hoja
  async createBackup(storeId) {
    try {
      const response = await fetch(`${this.backendUrl}/api/stores/${storeId}/backup`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creating backup');
      }

      return data;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  // Método helper para manejar el flujo completo de OAuth
  async handleGoogleOAuth(storeId) {
    try {
      // 1. Configurar OAuth2 client
      const client = google.accounts.oauth2.initCodeClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.code) {
            try {
              // 2. Crear hoja con el código de autorización
              const result = await this.createProductSheet(storeId, response.code);
              
              console.log('✅ Hoja creada exitosamente:', result);
              
              // 3. Opcional: Sincronizar productos iniciales
              const products = await this.getProducts(storeId);
              console.log('📦 Productos obtenidos:', products);
              
              return result;
            } catch (error) {
              console.error('❌ Error en el flujo OAuth:', error);
              throw error;
            }
          }
        }
      });

      // Iniciar el flujo OAuth
      client.requestCode();
    } catch (error) {
      console.error('Error in OAuth flow:', error);
      throw error;
    }
  }
}

// Ejemplo de uso en un componente React
export function useGoogleSheetsIntegration(storeId) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  const { user } = useAuth(); // Hook de autenticación existente

  const integration = useMemo(() => {
    if (!user?.idToken) return null;
    return new GoogleSheetsIntegration(backendUrl, user.idToken);
  }, [user?.idToken]);

  // Crear hoja de productos
  const createSheet = async () => {
    if (!integration) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await integration.handleGoogleOAuth(storeId);
      console.log('Hoja creada:', result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Obtener productos
  const loadProducts = async (forceRefresh = false) => {
    if (!integration) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await integration.getProducts(storeId, forceRefresh);
      setProducts(data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar productos
  const syncProducts = async () => {
    if (!integration) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await integration.syncProducts(storeId);
      console.log('Productos sincronizados:', result);
      
      // Recargar productos después de sincronizar
      await loadProducts(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Crear backup
  const createBackup = async () => {
    if (!integration) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await integration.createBackup(storeId);
      console.log('Backup creado:', result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    products,
    error,
    createSheet,
    loadProducts,
    syncProducts,
    createBackup
  };
}

// Ejemplo de componente React
export function StoreProductsManager({ storeId }) {
  const {
    loading,
    products,
    error,
    createSheet,
    loadProducts,
    syncProducts,
    createBackup
  } = useGoogleSheetsIntegration(storeId);

  useEffect(() => {
    loadProducts();
  }, [storeId]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Gestión de Productos - Google Sheets</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={createSheet}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Hoja de Productos'}
          </button>
          
          <button
            onClick={() => loadProducts(true)}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Recargar Productos'}
          </button>
          
          <button
            onClick={syncProducts}
            disabled={loading}
            className="bg-yellow-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Sincronizando...' : 'Sincronizar con Firestore'}
          </button>
          
          <button
            onClick={createBackup}
            disabled={loading}
            className="bg-purple-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Backup'}
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Productos ({products.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div key={product.id} className="border rounded p-4">
                <h4 className="font-semibold">{product.nombre}</h4>
                <p className="text-gray-600 text-sm">{product.descripcion}</p>
                <p className="text-green-600 font-bold">${product.precio}</p>
                {product.precioAnterior > 0 && (
                  <p className="text-gray-500 text-sm line-through">${product.precioAnterior}</p>
                )}
                <p className="text-blue-600 text-sm">{product.categoria}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

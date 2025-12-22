// Serviço para buscar dados do IBGE
// API oficial: https://servicodados.ibge.gov.br/api/docs

interface IBGEMunicipio {
  id: number
  nome: string
  microrregiao: {
    id: number
    nome: string
    mesorregiao: {
      id: number
      nome: string
      UF: {
        id: number
        sigla: string
        nome: string
      }
    }
  }
}

export async function fetchMunicipiosPiaui(): Promise<Array<{ id: string; name: string; state: string; mesorregiao: string; microrregiao: string }>> {
  try {
    // API do IBGE para municípios do Piauí (UF código 22)
    const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios', {
      next: { revalidate: 86400 } // Cache por 24 horas
    })

    if (!response.ok) {
      throw new Error('Erro ao buscar municípios do IBGE')
    }

    const data: IBGEMunicipio[] = await response.json()

    // Transformar dados do IBGE para o formato do nosso sistema
    return data.map((municipio) => ({
      id: municipio.id.toString(),
      name: municipio.nome,
      state: 'PI',
      mesorregiao: municipio.microrregiao.mesorregiao.nome,
      microrregiao: municipio.microrregiao.nome,
    }))
  } catch (error) {
    console.error('Erro ao buscar municípios do IBGE:', error)
    throw error
  }
}

// Função para sincronizar municípios do IBGE com o banco
export async function syncMunicipiosIBGE() {
  const municipios = await fetchMunicipiosPiaui()
  return municipios
}



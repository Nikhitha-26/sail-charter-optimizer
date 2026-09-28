import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { DecisionData } from '../types/api'

export default function Decisions() {
  const [data, setData] = useState<DecisionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .decision()
      .then((result) => setData(result as DecisionData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section>
        <p className="eyebrow">DECISION ENGINE</p>
        <h2>Loading charter decision...</h2>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <p className="eyebrow">DECISION ENGINE</p>
        <h2>Unable to load decision</h2>
        <p className="intro">{error}</p>
      </section>
    )
  }

  if (!data) return null

  const { decision, market, optimization } = data

  return (
    <section>
      <p className="eyebrow">DECISION ENGINE</p>

      <h2>{decision.strategy}</h2>

      <p className="intro">{decision.reason}</p>

      <div>
        <h3>Market Assessment</h3>

        <p>
          Risk Level: <strong>{market.risk_level}</strong>
        </p>

        <p>
          Base Freight:{' '}
          <strong>${market.base_freight_usd_per_mt.toFixed(2)}/MT</strong>
        </p>

        <p>
          LOW / HIGH:{' '}
          <strong>
            ${market.low_freight_usd_per_mt.toFixed(2)} / $
            {market.high_freight_usd_per_mt.toFixed(2)}
          </strong>
        </p>

        <p>
          Scenario Spread:{' '}
          <strong>{market.scenario_spread_pct.toFixed(2)}%</strong>
        </p>
      </div>

      <div>
        <h3>Charter Allocation</h3>

        <p>
          Cargo Required:{' '}
          <strong>
            {optimization.total_required_mt.toLocaleString()} MT
          </strong>
        </p>

        <p>
          Cargo Allocated:{' '}
          <strong>
            {optimization.total_allocated_mt.toLocaleString()} MT
          </strong>
        </p>

        <p>
          Quantity Coverage:{' '}
          <strong>{optimization.fulfillment_pct.toFixed(2)}%</strong>
        </p>

        <p>
          Base Cost:{' '}
          <strong>
            ${optimization.total_base_cost_usd.toLocaleString()}
          </strong>
        </p>

        <p>
          High-Scenario Exposure:{' '}
          <strong>
            ${optimization.high_scenario_exposure_usd.toLocaleString()}
          </strong>
        </p>

        <p>
          Deadline Feasibility Risks:{' '}
          <strong>{optimization.deadline_infeasible_cargoes}</strong>
        </p>
      </div>

      <div>
        <h3>Vessel Mix</h3>

        {Object.entries(optimization.vessel_mix).map(
          ([vessel, quantity]) => (
            <p key={vessel}>
              {vessel}:{' '}
              <strong>{quantity.toLocaleString()} MT</strong>
            </p>
          ),
        )}
      </div>

      <div>
        <h3>Decision Explanation</h3>

        {data.explanations.map((explanation, index) => (
          <p key={index}>{explanation}</p>
        ))}
      </div>
    </section>
  )
}
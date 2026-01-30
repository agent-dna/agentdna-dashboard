import type { InteractiontInfo } from "../types";
import type { AgentInfo } from "../types";

export interface AgentListItemProps {
  agent: AgentInfo;
  index: number;
  onClick: () => void;
}

export interface InteractionsListItemProps {
  interaction: InteractiontInfo;
  index: number;
}

export const AgentListItem = ({
  agent,
  index,
  onClick,
}: AgentListItemProps) => {
  console.log("name", agent)
  const displayName = agent.agent_name?.trim() || agent.agent_did;
  const factor = ((agent.total_interactions - agent.intrusion_count) / agent.total_interactions) * 100

  return (
    <div className="agent-list-item" onClick={onClick}>
      <div className="agent-item-number">{index + 1}</div>

      <div className="agent-item-info">
        <div className="agent-item-label">Agent Name</div>
        <div className="agent-item-id">{displayName}</div>
      </div>

      <div className="agent-item-info">
        <div className="agent-item-label">Reliability Factor</div>
        <div className="agent-item-id">
          {factor.toFixed(2)}
          </div>
      </div>
      <div className="agent-item-info">
        <div className="agent-item-label">Interactions</div>
        <div className="agent-item-id">{agent.total_interactions  }</div>
      </div>

      <div className="agent-item-info">
        <div className="agent-item-label">Intrusions</div>
        <div className="agent-item-id">{agent.intrusion_count}</div>
      </div>

      <div className="agent-item-info">
        <div className="agent-item-label">Tools Interacted</div>
        <div className="agent-item-id">{agent.agents_interacted}</div>
      </div>
    </div>
  );
};

import { epochToGMT } from "../helper/epochToTime";
import type { InteractionsListItemProps } from "./AgentList";

export const InteractionsListItem = ({
  interaction,
  index,
}: InteractionsListItemProps) => {
  const hostName = interaction.host_name?.trim() || interaction.host_did;
  const remoteName = interaction.remote_name?.trim() || interaction.remote_did;
  const intrusionStatus = interaction.intrusion_cause
    ? `${interaction.intrusion_cause}`
    : "None";
  const time = epochToGMT(interaction.epoch)
  const hasIntrusion = Boolean(interaction.intrusion_cause);

  return (
    <div
    className={`interaction-list-item ${
      hasIntrusion ? "interaction-intrusion" : ""
    }`}
  >
      <div className="interaction-col number">{index + 1}</div>

      <div className="interaction-col">
        <div className="interaction-label">Agent Name</div>
        <div className="interaction-value">{hostName}</div>
      </div>

      <div className="interaction-col">
        <div className="interaction-label">Tool Name</div>
        <div className="interaction-value">{remoteName}</div>
      </div>

      <div className="interaction-col">
        <div className="interaction-label">Time</div>
        <div className="interaction-value">{time}</div>
      </div>

      <div className="interaction-col">
        <div className="interaction-label">Intrusion</div>
        <div className="interaction-value">{intrusionStatus}</div>
      </div>
    </div>
  );
};
"use client";

import { useState } from "react";
import Image from "next/image";
import { SessionAnalysis } from "@/types/analysis";
import { ChatMessage } from "@/types/chat";
import { formatTime, formatStageLabel } from "@/utils/formatting";
import { Stage } from "@/types/session";

interface AnalysisReportProps {
  report: SessionAnalysis;
  messages: ChatMessage[];
  targetImage?: string | null;
  targetModel?: string | null;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 bg-primary/30 rounded-full" />
      <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
    <div className="text-xs text-primary/80 leading-relaxed pl-3">
      {children}
    </div>
  </div>
);

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2">
    {items.map((item, index) => (
      <li key={index} className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 mt-1.5 shrink-0" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const getStageColorClasses = (stage: Stage) => {
  const stageColors: { [key in Stage]: string } = {
    [Stage.STAGE_I]: "bg-red-500/10 text-red-600",
    [Stage.STAGE_II]: "bg-blue-500/10 text-blue-600",
    [Stage.STAGE_III]: "bg-green-500/10 text-green-600",
    [Stage.STAGE_IV]: "bg-amber-500/10 text-amber-600",
    [Stage.STAGE_V]: "bg-purple-500/10 text-purple-600",
    [Stage.STAGE_VI]: "bg-pink-500/10 text-pink-600",
  };
  return stageColors[stage] || "bg-gray-500/10 text-gray-600";
};

export default function AnalysisReport({
  report,
  messages,
  targetImage,
  targetModel,
}: AnalysisReportProps) {
  const [activeTab, setActiveTab] = useState("analysis");
  const [imageFit, setImageFit] = useState<"cover" | "contain">("cover");

  return (
    <div className="h-full flex flex-col card-elevated overflow-hidden">
      <div className="glass-dark px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-secondary/95">
          SESSION ANALYSIS REPORT
        </span>
        <div className="flex bg-white/10 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === "analysis"
                ? "bg-secondary text-primary shadow-sm"
                : "text-secondary/70 hover:text-secondary"
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === "chat"
                ? "bg-secondary text-primary shadow-sm"
                : "text-secondary/70 hover:text-secondary"
            }`}
          >
            Chat Log
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-5 overflow-y-auto">
        {activeTab === "analysis" ? (
          <>
            <Section title="Target Comparison">
              <div className="mb-3 flex justify-end">
                <button
                  onClick={() =>
                    setImageFit(imageFit === "cover" ? "contain" : "cover")
                  }
                  className="btn btn-ghost text-xs gap-1.5"
                  title={
                    imageFit === "cover"
                      ? "Click to view full image"
                      : "Click to fill view"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {imageFit === "cover" ? (
                      <>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                      </>
                    )}
                  </svg>
                  {imageFit === "cover" ? "View Full" : "Fill View"}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Actual Target */}
                <div className="card p-3 flex flex-col">
                  <div className="text-xs font-medium text-primary/70 mb-2 text-center">
                    Actual Target
                  </div>
                  <div className="flex-1 min-h-[180px] max-h-[350px] bg-primary/5 flex items-center justify-center rounded-lg overflow-hidden relative">
                    {targetImage ? (
                      <Image
                        src={`data:image/jpeg;base64,${targetImage}`}
                        alt="Actual Target Image"
                        width={600}
                        height={400}
                        className={`w-full h-full ${
                          imageFit === "cover" ? "object-cover" : "object-contain"
                        }`}
                      />
                    ) : (
                      <span className="text-xs text-primary/40">
                        Target not found
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Model */}
                <div className="card p-3 flex flex-col">
                  <div className="text-xs font-medium text-primary/70 mb-2 text-center">
                    Target Model
                  </div>
                  <div className="flex-1 min-h-[180px] max-h-[350px] bg-primary/5 flex items-center justify-center rounded-lg overflow-hidden relative">
                    {targetModel ? (
                      <Image
                        src={`data:image/jpeg;base64,${targetModel}`}
                        alt="AI Generated Target Model"
                        width={600}
                        height={400}
                        className={`w-full h-full ${
                          imageFit === "cover" ? "object-cover" : "object-contain"
                        }`}
                      />
                    ) : (
                      <span className="text-xs text-primary/40">
                        Model not generated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Section>
            <Section title="Overall Summary">
              <p>{report.overall_summary}</p>
            </Section>

            <Section title="Session Scoring">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {report.composite_score?.toFixed(1) ||
                      report.final_assessment_score}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-primary/50">
                    Composite
                  </div>
                </div>
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {report.overall_quality_score ||
                      report.final_assessment_score}
                    <span className="text-sm font-normal text-primary/50">
                      /7
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-primary/50">
                    Quality
                  </div>
                </div>
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {report.target_accuracy_score ||
                      report.final_assessment_score}
                    <span className="text-sm font-normal text-primary/50">
                      /7
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-primary/50">
                    Accuracy
                  </div>
                </div>
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {report.aol_contamination_score || 0}
                    <span className="text-sm font-normal text-primary/50">
                      /7
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-primary/50">
                    AOL
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="card p-4">
                  <h4 className="text-xs font-semibold text-primary/80 mb-3">
                    Detailed Scores
                  </h4>
                  <div className="space-y-2">
                    {[
                      {
                        label: "Sensory Details",
                        value:
                          report.sensory_details_score ||
                          report.final_assessment_score,
                      },
                      {
                        label: "Dimensional Data",
                        value:
                          report.dimensional_data_score ||
                          report.final_assessment_score,
                      },
                      {
                        label: "Emotional/Energetic",
                        value:
                          report.emotional_energetic_score ||
                          report.final_assessment_score,
                      },
                      {
                        label: "Consistency",
                        value:
                          report.consistency_score ||
                          report.final_assessment_score,
                      },
                      {
                        label: "Stage Development",
                        value:
                          report.stage_development_score ||
                          report.final_assessment_score,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-primary/60">{item.label}</span>
                        <span className="font-medium text-primary">
                          {item.value}/7
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <h4 className="text-xs font-semibold text-primary/80 mb-3">
                    Session Quality
                  </h4>
                  <div className="mb-3">
                    <div className="w-full bg-primary/10 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-linear-to-r from-primary to-primary-light h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${((report.composite_score || report.final_assessment_score) / 7) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        (report.composite_score ||
                          report.final_assessment_score) >= 5
                          ? "badge-success"
                          : (report.composite_score ||
                                report.final_assessment_score) >= 3
                            ? "badge-info"
                            : "badge-warning"
                      }`}
                    >
                      {(report.composite_score ||
                        report.final_assessment_score) >= 5
                        ? "Excellent"
                        : (report.composite_score ||
                              report.final_assessment_score) >= 3
                          ? "Good"
                          : (report.composite_score ||
                                report.final_assessment_score) >= 1
                            ? "Fair"
                            : "Poor"}
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            {report.session_strengths &&
              report.session_strengths.length > 0 && (
                <Section title="Session Strengths">
                  <BulletList items={report.session_strengths} />
                </Section>
              )}

            {report.session_weaknesses &&
              report.session_weaknesses.length > 0 && (
                <Section title="Areas for Improvement">
                  <BulletList items={report.session_weaknesses} />
                </Section>
              )}

            {report.aol_instances && report.aol_instances.length > 0 && (
              <Section title="AOL Contamination Instances">
                <BulletList items={report.aol_instances} />
              </Section>
            )}

            {report.target_correlations &&
              report.target_correlations.length > 0 && (
                <Section title="Target Correlations">
                  <BulletList items={report.target_correlations} />
                </Section>
              )}

            <Section title="Final Assessment Score">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-primary">
                  {report.final_assessment_score}
                </span>
                <span className="text-lg text-primary/40">/ 7</span>
              </div>
            </Section>

            <Section title="Stage-by-Stage Analysis">
              <div className="space-y-4">
                {report.stage_by_stage_analysis.map((stage, index) => (
                  <div
                    key={stage.stage}
                    className="card p-4 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge badge-info">
                        Stage {stage.stage}
                      </span>
                    </div>
                    <p className="text-xs text-primary/70 mb-3 leading-relaxed">
                      {stage.summary}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stage.key_elements.map((el, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-1 bg-primary/5 text-primary/70 rounded-md"
                        >
                          {el}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge badge-info text-[10px]">
                    {message.user.toUpperCase()}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${getStageColorClasses(message.stage)}`}
                  >
                    {formatStageLabel(message.stage)}
                  </span>
                  <span className="text-[10px] text-primary/40">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-primary/80 leading-relaxed pl-1 border-l-2 border-primary/10 whitespace-pre-wrap">
                  {message.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

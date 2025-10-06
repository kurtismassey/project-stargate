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
  <div className="mb-4">
    <h3 className="font-bold font-mono text-sm text-primary border-b border-primary border-opacity-30 mb-2 pb-1">
      {title}
    </h3>
    <div className="font-mono text-xs text-primary opacity-90">{children}</div>
  </div>
);

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc list-inside space-y-1">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

const getStageColorClasses = (stage: Stage) => {
  const stageColors: { [key in Stage]: string } = {
    [Stage.STAGE_I]: "bg-red-500/10 text-red-500",
    [Stage.STAGE_II]: "bg-blue-500/10 text-blue-500",
    [Stage.STAGE_III]: "bg-green-500/10 text-green-500",
    [Stage.STAGE_IV]: "bg-yellow-500/10 text-yellow-500",
    [Stage.STAGE_V]: "bg-purple-500/10 text-purple-500",
    [Stage.STAGE_VI]: "bg-pink-500/10 text-pink-500",
  };
  return stageColors[stage] || "bg-gray-500/10 text-gray-500";
};

export default function AnalysisReport({
  report,
  messages,
  targetImage,
  targetModel,
}: AnalysisReportProps) {
  const [activeTab, setActiveTab] = useState("analysis");

  return (
    <div className="h-full flex flex-col border border-primary rounded bg-secondary">
      <div className="bg-primary text-secondary px-3 py-2 text-xs font-mono font-semibold flex items-center justify-between">
        <span>SESSION ANALYSIS REPORT</span>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-2 py-0.5 text-xs rounded ${activeTab === "analysis" ? "bg-secondary text-primary" : "bg-transparent text-secondary hover:bg-white/20"}`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-2 py-0.5 text-xs rounded ${activeTab === "chat" ? "bg-secondary text-primary" : "bg-transparent text-secondary hover:bg-white/20"}`}
          >
            Chat Log
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 overflow-y-auto">
        {activeTab === "analysis" ? (
          <>
            <Section title="Target Comparison">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Actual Target */}
                <div>
                  <div className="text-primary font-mono text-xs font-semibold mb-2 text-center">
                    ACTUAL TARGET
                  </div>
                  <div className="min-h-[200px] max-h-[400px] bg-opacity-10 flex items-center justify-center rounded overflow-hidden">
                    {targetImage ? (
                      <Image
                        src={`data:image/jpeg;base64,${targetImage}`}
                        alt="Actual Target Image"
                        width={600}
                        height={400}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-primary opacity-50 font-mono text-sm">
                        TARGET NOT FOUND
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Model */}
                <div>
                  <div className="text-primary font-mono text-xs font-semibold mb-2 text-center">
                    TARGET MODEL
                  </div>
                  <div className="min-h-[200px] max-h-[400px] bg-opacity-10 flex items-center justify-center rounded overflow-hidden">
                    {targetModel ? (
                      <Image
                        src={`data:image/jpeg;base64,${targetModel}`}
                        alt="AI Generated Target Model"
                        width={600}
                        height={400}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-primary opacity-50 font-mono text-sm">
                        MODEL NOT GENERATED
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 border border-primary/30 rounded">
                  <div className="text-2xl font-bold text-primary">
                    {report.composite_score?.toFixed(1) ||
                      report.final_assessment_score}
                  </div>
                  <div className="text-xs text-primary opacity-70">
                    Composite Score
                  </div>
                </div>
                <div className="text-center p-3 border border-primary/30 rounded">
                  <div className="text-2xl font-bold text-primary">
                    {report.overall_quality_score ||
                      report.final_assessment_score}
                    /7
                  </div>
                  <div className="text-xs text-primary opacity-70">
                    Overall Quality
                  </div>
                </div>
                <div className="text-center p-3 border border-primary/30 rounded">
                  <div className="text-2xl font-bold text-primary">
                    {report.target_accuracy_score ||
                      report.final_assessment_score}
                    /7
                  </div>
                  <div className="text-xs text-primary opacity-70">
                    Target Accuracy
                  </div>
                </div>
                <div className="text-center p-3 border border-primary/30 rounded">
                  <div className="text-2xl font-bold text-primary">
                    {report.aol_contamination_score || 0}/7
                  </div>
                  <div className="text-xs text-primary opacity-70">
                    AOL Contamination
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Detailed Scores</h4>
                  <ul className="space-y-1 text-xs">
                    <li>
                      Sensory Details:{" "}
                      {report.sensory_details_score ||
                        report.final_assessment_score}
                      /7
                    </li>
                    <li>
                      Dimensional Data:{" "}
                      {report.dimensional_data_score ||
                        report.final_assessment_score}
                      /7
                    </li>
                    <li>
                      Emotional/Energetic:{" "}
                      {report.emotional_energetic_score ||
                        report.final_assessment_score}
                      /7
                    </li>
                    <li>
                      Consistency:{" "}
                      {report.consistency_score ||
                        report.final_assessment_score}
                      /7
                    </li>
                    <li>
                      Stage Development:{" "}
                      {report.stage_development_score ||
                        report.final_assessment_score}
                      /7
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Session Quality</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${((report.composite_score || report.final_assessment_score) / 7) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-primary opacity-70">
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
              <p className="font-bold text-lg">
                {report.final_assessment_score} / 7
              </p>
            </Section>

            <Section title="Stage-by-Stage Analysis">
              <div className="space-y-3">
                {report.stage_by_stage_analysis.map((stage) => (
                  <div
                    key={stage.stage}
                    className="pl-2 border-l-2 border-primary border-opacity-20"
                  >
                    <h4 className="font-semibold">Stage {stage.stage}</h4>
                    <p className="text-xs opacity-80 mb-1">{stage.summary}</p>
                    <ul className="list-disc list-inside text-xs">
                      {stage.key_elements.map((el, idx) => (
                        <li key={idx}>{el}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className="border-l-2 border-primary border-opacity-30 pl-2"
              >
                <div className="flex items-center gap-x-2 mb-1">
                  <span className="text-primary font-mono text-xs font-semibold">
                    [{message.user.toUpperCase()}]
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${getStageColorClasses(message.stage)}`}
                  >
                    {formatStageLabel(message.stage)}
                  </span>
                  <span className="text-primary font-mono text-[10px] opacity-50">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-primary font-mono text-xs opacity-90 whitespace-pre-wrap">
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

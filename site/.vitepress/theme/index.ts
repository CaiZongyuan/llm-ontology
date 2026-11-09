import DefaultTheme from 'vitepress/theme-without-fonts'
import { withBase, type Theme } from 'vitepress'
import Landing from './landing/Landing.vue'
import LoopStageFlow from './components/LoopStageFlow.vue'
import OntologyLayerExplorer from './components/OntologyLayerExplorer.vue'
import HospitalStandardMatrix from './components/HospitalStandardMatrix.vue'
import AutoOntologyWalkthrough from './components/AutoOntologyWalkthrough.vue'
import OpenSourceCompare from './components/OpenSourceCompare.vue'
import RagVsWikiSimulator from './components/RagVsWikiSimulator.vue'
import ProjectionalViewSwitcher from './components/ProjectionalViewSwitcher.vue'
import EvidenceReconcileLab from './components/EvidenceReconcileLab.vue'
import PolicyAstSandbox from './components/PolicyAstSandbox.vue'
import IncrementalImpactGraph from './components/IncrementalImpactGraph.vue'
import Quiz from './components/Quiz.vue'
import OntologyJourney from './components/OntologyJourney.vue'
import ChangeSetPreviewLab from './components/ChangeSetPreviewLab.vue'
import SourceTagLab from './components/SourceTagLab.vue'
import ActionProposalLab from './components/ActionProposalLab.vue'
import ReliabilityTraceLab from './components/ReliabilityTraceLab.vue'
import GoldenScenarioLab from './components/GoldenScenarioLab.vue'
import LessonCheck from './components/LessonCheck.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.config.globalProperties.$withBase = withBase
    const all = {
      Landing,
      LoopStageFlow,
      OntologyLayerExplorer,
      HospitalStandardMatrix,
      AutoOntologyWalkthrough,
      OpenSourceCompare,
      RagVsWikiSimulator,
      ProjectionalViewSwitcher,
      EvidenceReconcileLab,
      PolicyAstSandbox,
      IncrementalImpactGraph,
      Quiz,
      OntologyJourney,
      ChangeSetPreviewLab,
      SourceTagLab,
      ActionProposalLab,
      ReliabilityTraceLab,
      GoldenScenarioLab,
      LessonCheck,
    }
    for (const [name, c] of Object.entries(all)) app.component(name, c)
  },
} satisfies Theme

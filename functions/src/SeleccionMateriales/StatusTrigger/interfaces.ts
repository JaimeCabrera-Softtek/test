import { JobStatus } from '../../AltaMateriales/01_batch_creation/interfaces'

export interface BatchMaterialStatus {
    user: {
        uid: string
        name: string
        email: string
    },
    date: number
    jobs: { [jobID: string]: BatchMaterialStatus_Job }
    lastUpdate: number
    status: {
        [status_name: string]: number
    }
}

export interface BatchMaterialStatus_Job {
    Estilo: string
    status: JobStatus
}
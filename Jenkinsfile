pipeline {
  agent any

  stages {
    stage("Init") {
      steps {
        sh "yarn" 
      }
    }
    stage("Build") {
      steps { sh "yarn build" }
    }
    stage("Test") {
      steps { sh "yarn test" }
    }
    stage("Release") {
      when { branch "initial-release" }
      environment {
        NPM_TOKEN = credentials("NPM_TOKEN")
      }
      steps {
        withGitHubToken {
          sh 'export GITHUB_TOKEN="x-access-token:$GITHUB_TOKEN" && yarn release'
          sh 'git status'
          sh 'git log'
        }
      }
    }
  }
}
